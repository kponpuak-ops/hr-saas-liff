'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'

export default function LeavePage() {
  const [userDbId, setUserDbId] = useState<number | null>(null)
  const [leaveType, setLeaveType] = useState('ลาป่วย')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()

          // ค้นหา ID ของพนักงานจาก line_user_id
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('line_user_id', profile.userId)
            .single()

          if (userData) {
            setUserDbId(userData.id)
          }
        } else {
          liff.login()
        }
      } catch (err) {
        console.error('LIFF Init error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    initLiff()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userDbId) {
      setMessage('ไม่พบข้อมูลบัญชีพนักงาน กรุณาผูกบัญชีก่อน')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    const { error } = await supabase
      .from('leaves')
      .insert([
        {
          user_id: userDbId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
          status: 'pending',
        },
      ])

    if (error) {
      setMessage('เกิดข้อผิดพลาดในการยื่นใบลา')
    } else {
      setMessage('ยื่นใบลาเรียบร้อยแล้ว! รอ HR อนุมัติ')
      setReason('')
      setStartDate('')
      setEndDate('')
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return <div className="p-6 text-center text-slate-500 font-medium">กำลังโหลด...</div>
  }

  if (!userDbId) {
    return (
      <div className="p-6 text-center text-rose-500 font-medium">
        ยังไม่ได้ผูกบัญชีพนักงาน กรุณากลับไปหน้าหลักเพื่อผูกบัญชีก่อน
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
        <h1 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          📝 ยื่นใบลา (Leave Request)
        </h1>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm text-center font-medium ${message.includes('เรียบร้อย') ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-600'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทการลา</label>
            <select 
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="ลาป่วย">ลาป่วย</option>
              <option value="ลากิจ">ลากิจ</option>
              <option value="ลาพักร้อน">ลาพักร้อน</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">วันที่เริ่มลา</label>
            <input 
              type="date" 
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ถึงวันที่</label>
            <input 
              type="date" 
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">เหตุผลการลา</label>
            <textarea 
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลเพิ่มเติม (ถ้ามี)"
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium p-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งใบลา'}
          </button>
        </form>
      </div>
    </div>
  )
}