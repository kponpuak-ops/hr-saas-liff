'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LiffAttendanceRequestHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [requestHistory, setRequestHistory] = useState<any[]>([])

  // 💡 State สำหรับตัวกรองเดือน (ค่าเริ่มต้นคือเดือนปัจจุบัน YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      // 💡 เปลี่ยนมาใช้ liff ในการยืนยันตัวตน
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile()
        
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('line_user_id', profile.userId)
          .single()

        if (user) {
          const { data } = await supabase
            .from('attendance_requests')
            .select('*')
            .eq('user_id', user.id)
            .order('request_date', { ascending: false })
          
          if (data) setRequestHistory(data)
        }
      } else {
        liff.login()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ อนุมัติแล้ว</span>
      case 'manager_approved': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">🟡 รอ HR</span>
      case 'rejected': return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">❌ ไม่อนุมัติ</span>
      default: return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">⏳ รอตรวจสอบ</span>
    }
  }

  // 💡 ลอจิกการกรองข้อมูลตามเดือนที่เลือก
  const filteredHistory = filterMonth 
    ? requestHistory.filter(item => item.request_date.startsWith(filterMonth))
    : requestHistory

  // 💡 ลอจิกคำนวณสรุปยอดของเดือนนั้น
  const summary = filteredHistory.reduce((acc, curr) => {
    if (curr.status === 'approved') acc.approved++
    else if (curr.status === 'pending' || curr.status === 'manager_approved') acc.pending++
    else if (curr.status === 'rejected') acc.rejected++
    return acc
  }, { approved: 0, pending: 0, rejected: 0 })

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-slate-50 pb-12 p-4 max-w-md mx-auto animate-fade-in">
      <div className="space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            📜 ประวัติแก้เวลา
          </h1>
          <Link href="/liff" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
            กลับหน้าหลัก
          </Link>
        </div>

        {/* ตัวกรองเดือน-ปี */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">📅 ค้นหาตามเดือน-ปี</label>
          <input 
            type="month" 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
        </div>

        {/* สรุปยอดคำขอแก้เวลา */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
            📊 สรุปคำขอ (เดือนที่เลือก)
          </h2>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 text-center">
              <div className="text-[10px] font-bold text-emerald-600 mb-1">✅ อนุมัติ</div>
              <div className="text-lg font-extrabold text-emerald-700">{summary.approved} <span className="text-[10px] font-bold">ครั้ง</span></div>
            </div>
            <div className="bg-amber-50 p-2 rounded-xl border border-amber-100 text-center">
              <div className="text-[10px] font-bold text-amber-600 mb-1">⏳ รอตรวจ</div>
              <div className="text-lg font-extrabold text-amber-700">{summary.pending} <span className="text-[10px] font-bold">ครั้ง</span></div>
            </div>
            <div className="bg-rose-50 p-2 rounded-xl border border-rose-100 text-center">
              <div className="text-[10px] font-bold text-rose-600 mb-1">❌ ปฏิเสธ</div>
              <div className="text-lg font-extrabold text-rose-700">{summary.rejected} <span className="text-[10px] font-bold">ครั้ง</span></div>
            </div>
          </div>
        </div>

        {/* รายการคำขอ */}
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              ไม่พบประวัติการขอแก้ไขเวลาในเดือนนี้
            </div>
          ) : (
            filteredHistory.map((req, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                {req.status === 'approved' && <div className="absolute left-0 top-0 w-1 h-full bg-emerald-400"></div>}
                {req.status === 'rejected' && <div className="absolute left-0 top-0 w-1 h-full bg-rose-400"></div>}
                {(req.status === 'pending' || req.status === 'manager_approved') && <div className="absolute left-0 top-0 w-1 h-full bg-amber-400"></div>}
                
                <div className="flex justify-between items-start pl-2">
                  <span className="text-sm font-bold text-slate-800">
                    {new Date(req.request_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {getStatusBadge(req.status)}
                </div>
                
                <div className="flex gap-4 text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 ml-2">
                  {req.check_in_time && <span>เข้า: <strong className="text-indigo-600">{req.check_in_time.substring(0, 5)}</strong></span>}
                  {req.check_out_time && <span>ออก: <strong className="text-indigo-600">{req.check_out_time.substring(0, 5)}</strong></span>}
                </div>
                
                <div className="text-xs text-slate-500 break-words ml-2 mt-1">
                  <span className="font-bold">เหตุผล:</span> {req.reason}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}