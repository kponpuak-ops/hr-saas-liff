'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LeaveHistoryPage() {
  const [leaves, setLeaves] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // State สำหรับตัวกรองเดือน (ค่าเริ่มต้นคือเดือนปัจจุบัน YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    const initData = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        const profile = await liff.getProfile()

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

        const { data: leaveData, error } = await supabase
          .from('leaves')
          .select('*')
          .eq('user_id', userData.id)
          .order('start_date', { ascending: false })

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

  // กรองข้อมูลตามเดือนที่เลือก (เช็กจาก start_date หรือ end_date)
  const filteredLeaves = filterMonth 
    ? leaves.filter(leave => leave.start_date.startsWith(filterMonth) || leave.end_date.startsWith(filterMonth))
    : leaves

  // ฟังก์ชันสรุปข้อมูลการลาเฉพาะที่เคยยื่นในเดือนที่เลือก
  const calculateLeaveSummary = () => {
    const summary: Record<string, { approved: number; pending: number; rejected: number }> = {}

    filteredLeaves.forEach(leave => {
      const start = new Date(leave.start_date)
      const end = new Date(leave.end_date)
      const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1 

      if (!summary[leave.leave_type]) {
        summary[leave.leave_type] = { approved: 0, pending: 0, rejected: 0 }
      }

      if (leave.status === 'approved') summary[leave.leave_type].approved += diffDays
      if (leave.status === 'pending' || leave.status === 'manager_approved') summary[leave.leave_type].pending += diffDays
      if (leave.status === 'rejected') summary[leave.leave_type].rejected += diffDays
    })

    return summary
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'manager_approved': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200'
      default: return 'bg-amber-100 text-amber-700 border-amber-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '✅ อนุมัติแล้ว'
      case 'manager_approved': return '🟡 รอ HR อนุมัติ'
      case 'rejected': return '❌ ไม่อนุมัติ'
      default: return '⏳ รอดำเนินการ'
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">กำลังโหลดประวัติการลา...</div>
  }

  const leaveSummary = calculateLeaveSummary()
  const summaryKeys = Object.keys(leaveSummary)

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

        {/* ตัวกรองเดือน */}
        {!errorMsg && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 mb-1.5">📅 ค้นหาตามเดือน-ปี</label>
                <input 
                    type="month" 
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
            </div>
        )}

        {/* สรุปข้อมูลการลา (แสดงเฉพาะที่เคยยื่นในเดือนที่เลือก) */}
        {!errorMsg && summaryKeys.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">📊 สรุปการยื่นใบลาของคุณ (เดือนที่เลือก)</h2>
            <div className="space-y-2">
              {summaryKeys.map((type) => {
                const stats = leaveSummary[type]
                return (
                  <div key={type} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="font-bold text-slate-700 mb-1.5 text-sm">{type}</div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {stats.approved > 0 && <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded-md">✅ อนุมัติ: {stats.approved} วัน</span>}
                      {stats.pending > 0 && <span className="text-amber-700 font-bold bg-amber-100 px-2 py-1 rounded-md">⏳ รอตรวจสอบ: {stats.pending} วัน</span>}
                      {stats.rejected > 0 && <span className="text-rose-700 font-bold bg-rose-100 px-2 py-1 rounded-md">❌ ไม่อนุมัติ: {stats.rejected} วัน</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {errorMsg ? (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-center text-sm font-bold border border-rose-100">
            {errorMsg}
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center border border-slate-100 shadow-sm">
            <span className="text-4xl block mb-2">📭</span>
            <p className="text-slate-500 font-medium text-sm">ไม่พบประวัติการยื่นใบลาในเดือนนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeaves.map((leave) => (
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