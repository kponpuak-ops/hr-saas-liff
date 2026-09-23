'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AttendanceHistoryPage() {
  const [history, setHistory] = useState<any[]>([])
  const [holidays, setHolidays] = useState<string[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
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
            .select('id, company_id')
            .eq('line_user_id', profile.userId)
            .single()

          if (userData) {
            fetchAttendanceHistory(userData)
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

  const fetchAttendanceHistory = async (user: any) => {
    const [attRes, holRes, leaveRes] = await Promise.all([
      supabase.from('attendance').select('*, work_shifts(shift_name)').eq('user_id', user.id).order('action_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('company_holidays').select('holiday_date').eq('company_id', user.company_id),
      supabase.from('leaves').select('start_date, end_date').eq('user_id', user.id).eq('status', 'approved')
    ])

    if (attRes.data) setHistory(attRes.data)
    if (holRes.data) setHolidays(holRes.data.map(h => h.holiday_date))
    if (leaveRes.data) setLeaves(leaveRes.data)
    
    setIsLoading(false)
  }

  // 1. กรองข้อมูลตามเดือนที่เลือก
  const filteredHistory = filterMonth 
    ? history.filter(item => item.action_date.startsWith(filterMonth))
    : history

  // 2. คำนวณยอดสรุปประจำเดือน (สาย, ออกก่อน, ยอดหัก)
  const summary = filteredHistory.reduce((acc, curr) => {
    acc.lateMins += (curr.late_minutes || 0)
    acc.earlyMins += (curr.early_leave_minutes || 0)
    acc.totalDeduction += (curr.deduction_amount || 0)
    return acc
  }, { lateMins: 0, earlyMins: 0, totalDeduction: 0 })

  // 💡 3. คำนวณวันขาดงาน/ลืมสแกน (นับทุกวัน ไม่เว้นเสาร์-อาทิตย์ อิงตามวันหยุดบริษัทเท่านั้น)
  let absentDaysCount = 0
  if (filterMonth) {
    const [year, month] = filterMonth.split('-').map(Number)
    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0)
    const today = new Date()
    
    // หาวันที่สิ้นสุดการคำนวณ: ถ้าเป็นเดือนปัจจุบัน ให้นับถึงเมื่อวาน ถ้าเดือนอดีต ให้นับถึงวันสิ้นเดือน
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    const calcEndDate = endOfMonth > yesterday ? yesterday : endOfMonth

    for (let d = new Date(startOfMonth); d <= calcEndDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) // รูปแบบ YYYY-MM-DD
      
      // ข้ามวันหยุดบริษัท (อิงตามที่ HR ตั้งค่าไว้ในระบบ)
      const isHol = holidays.includes(dateStr)
      
      // ข้ามวันที่ลาผ่านแล้ว
      const hasLeave = leaves.some(l => dateStr >= l.start_date && dateStr <= l.end_date)
      
      // ตรวจสอบว่ามีการลงเวลาในวันนั้นหรือไม่
      const hasScanned = history.some(h => h.action_date === dateStr)

      // ถ้าไม่ใช่วันหยุด ไม่ใช่วันลา และไม่มีข้อมูลสแกน = ขาดงาน (ไม่สนใจว่าเป็นวันอะไร)
      if (!isHol && !hasLeave && !hasScanned) {
        absentDaysCount++
      }
    }
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 0 }).format(amount)
  }

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-8">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            📅 ประวัติการลงเวลา
          </h1>
          <Link href="/liff" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
            กลับหน้าหลัก
          </Link>
        </div>

        {/* ตัวกรองเดือน */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">ค้นหาตามเดือน-ปี</label>
          <input 
            type="month" 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
        </div>

        {/* สรุปยอดรายเดือนแบบใหม่ 3 ช่อง */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 mb-1">
            📊 สรุปการมาสาย/ขาดงาน (เดือนที่เลือก)
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
              <div className="text-[10px] font-bold text-amber-600 mb-1">สาย/ออกก่อนรวม</div>
              <div className="text-xl font-extrabold text-amber-700">
                {summary.lateMins + summary.earlyMins} <span className="text-xs font-bold">นาที</span>
              </div>
            </div>
            
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-600 mb-1">ขาดงาน / ลืมสแกน</div>
              <div className="text-xl font-extrabold text-slate-700">
                {absentDaysCount} <span className="text-xs font-bold">วัน</span>
              </div>
            </div>

            <div className="col-span-2 bg-rose-50 p-3 rounded-xl border border-rose-100 flex justify-between items-center">
              <div className="text-[11px] font-bold text-rose-600">ยอดหักเงินสะสม (สาย/ออกก่อน)</div>
              <div className="text-xl font-extrabold text-rose-700">
                {formatMoney(summary.totalDeduction)} <span className="text-xs font-bold">บาท</span>
              </div>
            </div>
          </div>
          {absentDaysCount > 0 && (
            <div className="text-[10px] text-rose-500 mt-1 bg-white">
              * พบการขาดงาน {absentDaysCount} วัน หากลืมสแกนกรุณาติดต่อ HR
            </div>
          )}
        </div>

        {/* รายการประวัติ */}
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-500 text-sm font-medium">
              ไม่พบประวัติการลงเวลาในเดือนนี้
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
                
                {/* วันที่ และ Badge */}
                <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                  <div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {new Date(item.action_date).toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                    {item.work_shifts && (
                      <div className="text-[10px] text-purple-600 font-bold mt-0.5">กะ: {item.work_shifts.shift_name}</div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    {item.is_manual && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        ✍️ HR แก้ไขเวลา
                      </span>
                    )}
                    {item.deduction_amount > 0 && (
                      <span className="text-rose-600 text-xs font-bold">
                        หัก {formatMoney(item.deduction_amount)} ฿
                      </span>
                    )}
                  </div>
                </div>
                
                {/* เวลาเข้า-ออก */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5">เวลาเข้างาน</div>
                    <div className={`text-sm font-extrabold ${item.late_minutes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatTime(item.check_in_time)}
                    </div>
                    {item.late_minutes > 0 && (
                      <div className="text-[10px] font-bold text-amber-600 mt-0.5">สาย {item.late_minutes} นาที</div>
                    )}
                  </div>
                  
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5">เวลาออกงาน</div>
                    {item.check_out_time ? (
                      <>
                        <div className={`text-sm font-extrabold ${item.early_leave_minutes > 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                          {formatTime(item.check_out_time)}
                        </div>
                        {item.early_leave_minutes > 0 && (
                          <div className="text-[10px] font-bold text-rose-600 mt-0.5">ออกก่อน {item.early_leave_minutes} นาที</div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs font-bold text-slate-400 mt-1">กำลังปฏิบัติงาน</div>
                    )}
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