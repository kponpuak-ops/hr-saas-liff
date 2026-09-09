'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function OTHistoryPage() {
  const [history, setHistory] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // State สำหรับตัวกรองเดือน (ค่าเริ่มต้นคือเดือนปัจจุบัน YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

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

          if (userData) {
            fetchOTAndAttendance(userData.id)
          }
        } else {
          liff.login()
        }
      } catch (err) {
        console.error('Init error:', err)
        setIsLoading(false)
      }
    }
    initLiff()
  }, [])

  const fetchOTAndAttendance = async (userId: number) => {
    const [otRes, attRes] = await Promise.all([
      supabase.from('ot_requests').select('*').eq('user_id', userId).order('request_date', { ascending: false }),
      supabase.from('attendance').select('action_date, check_out_time').eq('user_id', userId)
    ])

    if (otRes.data) setHistory(otRes.data)
    if (attRes.data) setAttendance(attRes.data)
    
    setIsLoading(false)
  }

  const calculateRequestedHours = (start: string, end: string) => {
    if (!start || !end) return 0
    const [h1, m1] = start.split(':').map(Number)
    const [h2, m2] = end.split(':').map(Number)
    let diff = (h2 + m2 / 60) - (h1 + m1 / 60)
    if (diff < 0) diff += 24
    return diff
  }

  const calculateActualOT = (otRequest: any) => {
    if (otRequest.status !== 'approved') return 0

    const attRecord = attendance.find(a => a.action_date === otRequest.request_date)
    const reqHours = calculateRequestedHours(otRequest.start_time, otRequest.end_time)
    
    if (!attRecord || !attRecord.check_out_time) return 0

    const checkOutDate = new Date(attRecord.check_out_time)
    const reqStartDate = new Date(`${otRequest.request_date}T${otRequest.start_time}`)
    
    let actualHours = (checkOutDate.getTime() - reqStartDate.getTime()) / (1000 * 60 * 60)
    
    if (actualHours <= 0) return 0

    const validHours = Math.min(reqHours, actualHours)
    const finalHours = Math.floor(validHours * 2) / 2

    return finalHours
  }

  const filteredHistory = filterMonth 
    ? history.filter(item => item.request_date.startsWith(filterMonth))
    : history

  const otSummary = filteredHistory.reduce((acc, curr) => {
    const reqHrs = calculateRequestedHours(curr.start_time, curr.end_time)
    
    if (curr.status === 'approved') {
      acc.approvedReq += reqHrs
      acc.actualDone += calculateActualOT(curr)
    } else if (curr.status === 'pending' || curr.status === 'manager_approved') {
      acc.pending += reqHrs
    } else if (curr.status === 'rejected') {
      acc.rejected += reqHrs
    }
    return acc
  }, { approvedReq: 0, actualDone: 0, pending: 0, rejected: 0 })

  if (isLoading) return <div className="p-6 text-center text-slate-500 font-medium">กำลังโหลด...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-8">
      <div className="max-w-md mx-auto space-y-4">
        
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            ⏳ ประวัติการขอ OT
          </h1>
          <Link href="/liff" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
            กลับหน้าหลัก
          </Link>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">📅 ค้นหาตามเดือน-ปี</label>
          <input 
            type="month" 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
            📊 สรุปยอด OT (เดือนที่เลือก)
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <div className="text-[10px] font-bold text-indigo-500 mb-1">✅ อนุมัติแล้ว (ตามที่ยื่นขอ)</div>
              <div className="text-xl font-extrabold text-indigo-700">{otSummary.approvedReq.toFixed(1)} <span className="text-xs font-bold">ชม.</span></div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <div className="text-[10px] font-bold text-emerald-600 mb-1">🎯 คิดเงินจริง (สแกนออก)</div>
              <div className="text-xl font-extrabold text-emerald-700">{otSummary.actualDone.toFixed(1)} <span className="text-xs font-bold">ชม.</span></div>
            </div>
          </div>
          
          {(otSummary.pending > 0 || otSummary.rejected > 0) && (
            <div className="flex gap-2 mt-2">
              {otSummary.pending > 0 && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">⏳ รอตรวจสอบ: {otSummary.pending.toFixed(1)} ชม.</span>}
              {otSummary.rejected > 0 && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">❌ ไม่อนุมัติ: {otSummary.rejected.toFixed(1)} ชม.</span>}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-500 text-sm font-medium">
              ไม่พบประวัติการขอ OT ในเดือนนี้
            </div>
          ) : (
            filteredHistory.map((item) => {
              const reqHrs = calculateRequestedHours(item.start_time, item.end_time)
              const actualHrs = calculateActualOT(item)
              
              return (
                <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-slate-400 mb-0.5">วันที่ทำ OT</div>
                      <div className="text-sm font-bold text-slate-800">
                        {new Date(item.request_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div>
                      {item.status === 'pending' && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700">⏳ รอดำเนินการ</span>}
                      {item.status === 'manager_approved' && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-700">🟡 รอ HR อนุมัติ</span>}
                      {item.status === 'approved' && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700">✅ อนุมัติ</span>}
                      {item.status === 'rejected' && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700">❌ ไม่อนุมัติ</span>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-3">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-0.5">เวลาที่ขอ (รวมชั่วโมง)</div>
                      <div className="text-sm font-bold text-indigo-600">
                        {item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)} น.
                        <span className="block text-xs mt-0.5">({reqHrs.toFixed(1)} ชม.)</span>
                      </div>
                    </div>
                    {item.status === 'approved' && (
                      <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <div className="text-[10px] font-bold text-emerald-600 mb-0.5">ชั่วโมง OT คิดเงินจริง</div>
                        <div className="text-sm font-extrabold text-emerald-700">
                          {actualHrs > 0 ? `${actualHrs.toFixed(1)} ชม.` : 'รอดึงเวลาสแกนออก'}
                        </div>
                      </div>
                    )}
                  </div>

                  {item.reason && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1">
                      <span className="font-bold text-slate-500">เหตุผล: </span>{item.reason}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}