'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AttendanceHistoryPage() {
  const [records, setRecords] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // State สำหรับตัวกรองเดือน (ค่าเริ่มต้นคือเดือนปัจจุบัน YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    initLiff()
  }, [])

  const initLiff = async () => {
    try {
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile()
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('line_user_id', profile.userId)
          .single()

        if (user) {
          fetchAttendance(user.id)
        }
      } else {
        liff.login()
      }
    } catch (err) {
      console.error('Init error:', err)
      setIsLoading(false)
    }
  }

  const fetchAttendance = async (userId: number) => {
    // ดึงข้อมูลการลงเวลา พร้อมเชื่อมข้อมูลกะการทำงาน (ถ้ามี)
    const { data } = await supabase
      .from('attendance')
      .select('*, work_shifts(shift_name)')
      .eq('user_id', userId)
      .order('action_date', { ascending: false })
    
    if (data) setRecords(data)
    setIsLoading(false)
  }

  const filteredRecords = filterMonth 
    ? records.filter(item => item.action_date.startsWith(filterMonth))
    : records

  // คำนวณสรุปข้อมูลประจำเดือน
  const summary = filteredRecords.reduce((acc, curr) => {
    acc.totalDays++
    if (curr.late_minutes && curr.late_minutes > 0) acc.totalLateMins += curr.late_minutes
    if (curr.early_leave_minutes && curr.early_leave_minutes > 0) acc.totalEarlyMins += curr.early_leave_minutes
    if (curr.is_manual) acc.manualAdjustments++
    return acc
  }, { totalDays: 0, totalLateMins: 0, totalEarlyMins: 0, manualAdjustments: 0 })

  if (isLoading) return <div className="p-6 text-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-8 animate-fade-in">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            📅 ประวัติลงเวลา
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

        {/* สรุปยอด (เดือนที่เลือก) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
            📊 สถิติการลงเวลา (เดือนที่เลือก)
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center">
              <div className="text-[10px] font-bold text-indigo-500 mb-1">ทำงานทั้งหมด</div>
              <div className="text-xl font-extrabold text-indigo-700">{summary.totalDays} <span className="text-xs font-bold">วัน</span></div>
            </div>
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-center">
              <div className="text-[10px] font-bold text-rose-600 mb-1">มาสายรวม</div>
              <div className="text-xl font-extrabold text-rose-700">{summary.totalLateMins} <span className="text-xs font-bold">นาที</span></div>
            </div>
          </div>
          
          {(summary.totalEarlyMins > 0 || summary.manualAdjustments > 0) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {summary.totalEarlyMins > 0 && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">ออกก่อนเวลารวม: {summary.totalEarlyMins} นาที</span>}
              {summary.manualAdjustments > 0 && <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700">ถูกแก้ไขเวลาโดย HR: {summary.manualAdjustments} รายการ</span>}
            </div>
          )}
        </div>

        {/* รายการประวัติ */}
        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-500 text-sm font-medium">
              ไม่พบประวัติการลงเวลาในเดือนนี้
            </div>
          ) : (
            filteredRecords.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
                {/* แถบสีแสดงสถานะด้านซ้าย */}
                <div className={`absolute left-0 top-0 w-1.5 h-full ${item.check_out_time ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                
                <div className="flex justify-between items-start pl-2">
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      {new Date(item.action_date).toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                    {item.work_shifts && (
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">กะ: {item.work_shifts.shift_name}</div>
                    )}
                  </div>
                  <div>
                    {item.is_manual && <span className="px-2 py-0.5 mr-1 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold">📝 แก้ไขโดยระบบ</span>}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pl-2 mt-1">
                  {/* เวลาเข้า */}
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 mb-1 flex justify-between">
                      <span>เวลาเข้างาน</span>
                      {item.late_minutes > 0 && <span className="text-rose-500">สาย {item.late_minutes} น.</span>}
                    </div>
                    <div className={`text-sm font-extrabold ${item.late_minutes > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                    </div>
                  </div>

                  {/* เวลาออก */}
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 mb-1 flex justify-between">
                      <span>เวลาออกงาน</span>
                      {item.early_leave_minutes > 0 && <span className="text-rose-500">ออกก่อน {item.early_leave_minutes} น.</span>}
                    </div>
                    <div className={`text-sm font-extrabold ${!item.check_out_time ? 'text-amber-500' : item.early_leave_minutes > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ยังไม่ลงเวลา'} น.
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}