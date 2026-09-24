'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LiffAttendanceHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [requestHistory, setRequestHistory] = useState<any[]>([])

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single()

      if (user) {
        const { data } = await supabase
          .from('attendance_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        if (data) setRequestHistory(data)
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

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-slate-50 pb-12 p-4 max-w-md mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-lg font-black text-slate-800">📜 ประวัติแก้เวลา</h1>
          <p className="text-xs text-slate-500 mt-1">รายการขอปรับปรุงเวลาทำงานทั้งหมด</p>
        </div>
        <Link href="/liff" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
          กลับหน้าหลัก
        </Link>
      </div>

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