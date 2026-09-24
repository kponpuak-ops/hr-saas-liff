'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LiffAttendanceRequestPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  
  // State สำหรับฟอร์ม
  const [requestDate, setRequestDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }))
  const [checkInTime, setCheckInTime] = useState('')
  const [checkOutTime, setCheckOutTime] = useState('')
  const [reason, setReason] = useState('')

  // State สำหรับประวัติคำขอ
  const [requestHistory, setRequestHistory] = useState<any[]>([])

  useEffect(() => {
    fetchUserDataAndHistory()
  }, [])

  const fetchUserDataAndHistory = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: user } = await supabase
        .from('users')
        .select('id, company_id, first_name, last_name')
        .eq('auth_id', session.user.id)
        .single()

      if (user) {
        setUserInfo(user)
        fetchHistory(user.id)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (userId: number) => {
    const { data } = await supabase
      .from('attendance_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (data) setRequestHistory(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!checkInTime && !checkOutTime) {
      alert('กรุณาระบุเวลาเข้างาน หรือ เวลาออกงาน ที่ต้องการแก้ไขอย่างน้อย 1 ช่องครับ')
      return
    }
    if (!reason.trim()) {
      alert('กรุณาระบุเหตุผลการขอแก้ไขเวลาครับ')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        company_id: userInfo.company_id,
        user_id: userInfo.id,
        request_date: requestDate,
        check_in_time: checkInTime || null,
        check_out_time: checkOutTime || null,
        reason: reason,
        status: 'pending'
      }

      // เปลี่ยนบรรทัดนี้: ให้ .select().single() เพื่อเอา ID ที่เพิ่งสร้าง
      const { data: newReq, error } = await supabase.from('attendance_requests').insert([payload]).select().single()
      
      if (error) throw error

      // 💡 ยิง API ไปแจ้งเตือน
      fetch('/api/notify-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newReq.id, status: 'pending' })
      })

      alert('ส่งคำขอแก้ไขเวลาเรียบร้อยแล้ว กรุณารอหัวหน้าตรวจสอบครับ')
      
      // ล้างฟอร์มและโหลดประวัติใหม่
      setCheckInTime('')
      setCheckOutTime('')
      setReason('')
      fetchHistory(userInfo.id)
      
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ อนุมัติแล้ว</span>
      case 'rejected': return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">❌ ไม่อนุมัติ</span>
      default: return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">⏳ รอตรวจสอบ</span>
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-slate-50 pb-12 p-4 max-w-md mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-lg font-black text-slate-800">⏱️ ขอปรับปรุงเวลา</h1>
          <p className="text-xs text-slate-500 mt-1">แจ้งลืมสแกนนิ้ว / แก้ไขเวลาทำงาน</p>
        </div>
        <Link href="/liff" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
          กลับหน้าหลัก
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">📅 วันที่ต้องการแก้ไข *</label>
            <input 
              type="date" 
              required
              max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })}
              value={requestDate}
              onChange={e => setRequestDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เวลาเข้างาน</label>
              <input 
                type="time" 
                value={checkInTime}
                onChange={e => setCheckInTime(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เวลาออกงาน</label>
              <input 
                type="time" 
                value={checkOutTime}
                onChange={e => setCheckOutTime(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">* กรอกเฉพาะเวลาที่ต้องการแก้ไข (ถ้าลืมแค่สแกนออก ให้กรอกแค่เวลาออก)</p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">📝 เหตุผล *</label>
            <textarea 
              required
              rows={2}
              placeholder="เช่น ลืมลงเวลา, ไปพบลูกค้าที่พารากอน, แบตมือถือหมด..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all text-sm disabled:opacity-50"
          >
            {submitting ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอแก้ไขเวลา'}
          </button>
        </div>
      </form>

      {/* ประวัติคำขอ */}
      <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">📜 ประวัติคำขอแก้ไขเวลา</h2>
      <div className="space-y-3">
        {requestHistory.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            ยังไม่มีประวัติการส่งคำขอ
          </div>
        ) : (
          requestHistory.map((req, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-sm font-bold text-slate-800">
                  {new Date(req.request_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {getStatusBadge(req.status)}
              </div>
              
              <div className="flex gap-4 text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {req.check_in_time && <span>เข้า: <strong className="text-indigo-600">{req.check_in_time.substring(0, 5)}</strong></span>}
                {req.check_out_time && <span>ออก: <strong className="text-indigo-600">{req.check_out_time.substring(0, 5)}</strong></span>}
              </div>
              
              <div className="text-xs text-slate-500 break-words">
                <span className="font-bold">เหตุผล:</span> {req.reason}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}