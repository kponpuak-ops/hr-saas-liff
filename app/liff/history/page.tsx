'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LeaveHistoryPage() {
  const [leaves, setLeaves] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const initData = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        const profile = await liff.getProfile()

        // 1. หา User ID จาก LINE
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('line_user_id', profile.userId)
          .single()

        if (!userData) {
          setErrorMsg('ไม่พบข้อมูลพนักงาน กรุณาผูกบัญชีก่อน')
          setIsLoading(false)
          return
        }

        // 2. ดึงประวัติการลาของพนักงานคนนี้
        const { data: leaveData, error } = await supabase
          .from('leaves')
          .select('*')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setLeaves(leaveData || [])
      } catch (err: any) {
        console.error('Error fetching leave history:', err.message)
        setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setIsLoading(false)
      }
    }
    
    initData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200'
      default: return 'bg-amber-100 text-amber-700 border-amber-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '✅ อนุมัติแล้ว'
      case 'rejected': return '❌ ไม่อนุมัติ'
      default: return '⏳ รอตรวจสอบ'
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">กำลังโหลดประวัติการลา...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-8">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            📋 ประวัติการลาของคุณ
          </h1>
          <Link href="/liff" className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
            กลับหน้าหลัก
          </Link>
        </div>

        {errorMsg ? (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-center text-sm font-bold border border-rose-100">
            {errorMsg}
          </div>
        ) : leaves.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center border border-slate-100 shadow-sm">
            <span className="text-4xl block mb-2">📭</span>
            <p className="text-slate-500 font-medium text-sm">ยังไม่มีประวัติการยื่นใบลา</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map((leave) => (
              <div key={leave.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-800">{leave.leave_type}</span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${getStatusColor(leave.status)}`}>
                    {getStatusText(leave.status)}
                  </span>
                </div>
                
                <div className="text-xs text-slate-500 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">📅</span> 
                    {new Date(leave.start_date).toLocaleDateString('th-TH')} - {new Date(leave.end_date).toLocaleDateString('th-TH')}
                  </div>
                  {leave.reason && (
                    <div className="flex items-start gap-1.5 mt-1 bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-400">📝</span>
                      <span className="italic">{leave.reason}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}