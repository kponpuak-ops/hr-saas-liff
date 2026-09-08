'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'

export default function OTRequestPage() {
  const [userDbId, setUserDbId] = useState<number | null>(null)
  
  const [requestDate, setRequestDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
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
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('line_user_id', profile.userId)
            .single()

          if (userData) setUserDbId(userData.id)
        } else {
          liff.login()
        }
      } catch (err) {
        console.error('Init error:', err)
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
      .from('ot_requests')
      .insert([
        {
          user_id: userDbId,
          request_date: requestDate,
          start_time: startTime,
          end_time: endTime,
          reason: reason,
          status: 'pending',
        },
      ])

    if (error) {
      setMessage('เกิดข้อผิดพลาดในการยื่นขอ OT')
    } else {
      setMessage('ยื่นขอ OT เรียบร้อยแล้ว! รอหัวหน้าอนุมัติ')
      setRequestDate('')
      setStartTime('')
      setEndTime('')
      setReason('')
    }
    setIsSubmitting(false)
  }

  if (isLoading) return <div className="p-6 text-center text-slate-500 font-medium">กำลังโหลด...</div>

  if (!userDbId) {
    return (
      <div className="p-6 text-center text-rose-500 font-medium">
        ยังไม่ได้ผูกบัญชีพนักงาน กรุณากลับไปหน้าหลักเพื่อผูกบัญชีก่อน
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-8">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            ⏱️ ยื่นขอทำโอที (OT)
          </h1>
          <button 
            onClick={() => window.location.href = '/liff'}
            className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition"
          >
            ✕ ปิด
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm text-center font-bold ${message.includes('เรียบร้อย') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">วันที่ทำ OT *</label>
            <input 
              type="date" 
              required
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">เวลาเริ่ม *</label>
              <input 
                type="time" 
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">เวลาสิ้นสุด *</label>
              <input 
                type="time" 
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">รายละเอียดงาน / เหตุผลที่ทำ *</label>
            <textarea 
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุงานที่จะทำในช่วง OT..."
              className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-4"
          >
            {isSubmitting ? 'กำลังส่งคำขอ...' : '📨 ส่งคำขออนุมัติ OT'}
          </button>
        </form>
      </div>
    </div>
  )
}