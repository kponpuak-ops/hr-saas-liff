'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AttendanceHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  // ข้อมูลรายเดือน
  const [attendance, setAttendance] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  
  // ตัวกรองเดือน (ค่าเริ่มต้นคือเดือนปัจจุบัน)
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

  // สรุปข้อมูล
  const [summary, setSummary] = useState({
    workDaysInMonth: 26, // สมมติฐานวันทำงานพื้นฐาน
    workedDays: 0,
    leaveDays: 0,
    absentDays: 0,
    lateMins: 0,
    lateDeduction: 0,
    absentDeduction: 0,
    hasDiligentAllowance: true
  })

  // ปฏิทินรายวัน
  const [calendarDays, setCalendarDays] = useState<any[]>([])

  useEffect(() => {
    initLiff()
  }, [])

  useEffect(() => {
    if (user) {
      fetchMonthlyData()
    }
  }, [filterMonth, user])

  const initLiff = async () => {
    try {
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile()
        const { data: userData } = await supabase
          .from('users')
          .select('*, company_settings(*)')
          .eq('line_user_id', profile.userId)
          .single()

        if (userData) {
          setUser(userData)
        }
      } else {
        liff.login()
      }
    } catch (err) {
      console.error('Init error:', err)
      setLoading(false)
    }
  }

  const fetchMonthlyData = async () => {
    setLoading(true)
    
    const year = parseInt(filterMonth.split('-')[0])
    const month = parseInt(filterMonth.split('-')[1])
    
    // หาวันแรกและวันสุดท้ายของเดือน
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    // ดึงข้อมูลการลงเวลา
    const { data: attData } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .gte('action_date', startDate)
      .lte('action_date', endDate)

    // ดึงข้อมูลการลา (ที่อนุมัติแล้ว)
    const { data: leaveData } = await supabase
      .from('leaves')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    const attRecords = attData || []
    const leaveRecords = leaveData || []
    
    setAttendance(attRecords)
    setLeaves(leaveRecords)
    
    generateCalendar(year, month, attRecords, leaveRecords)
    setLoading(false)
  }

  const generateCalendar = (year: number, month: number, attRecords: any[], leaveRecords: any[]) => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const days = []
    let worked = 0
    let leavesCount = 0
    let absents = 0
    let lateMins = 0
    let workDaysCount = 0

    // อัตราการหักเงิน (สมมติฐาน หรือดึงจาก settings)
    const deductRatePerMin = user.company_settings?.[0]?.late_deduction_per_minute || 5
    const dailyWage = user.base_salary ? (user.base_salary / 30) : 500

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i)
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      
      // สมมติว่าวันอาทิตย์เป็นวันหยุด (สามารถปรับแก้ให้ดึงจาก Company Settings ได้)
      const isWeekend = d.getDay() === 0
      if (!isWeekend) workDaysCount++

      const att = attRecords.find(a => a.action_date === dateStr)
      // เช็กว่าวันนี้อยู่ในช่วงลาหรือไม่
      const leave = leaveRecords.find(l => dateStr >= l.start_date && dateStr <= l.end_date)

      let status = 'future'
      let badge = ''
      
      if (d > today) {
        status = 'future'
        badge = '-'
      } else if (leave) {
        status = 'leave'
        badge = `ลา (${leave.leave_type})`
        if (!isWeekend) leavesCount++
      } else if (att) {
        status = 'present'
        badge = 'มาทำงาน'
        worked++
        lateMins += (att.late_minutes || 0) + (att.early_leave_minutes || 0)
      } else if (isWeekend) {
        status = 'holiday'
        badge = 'วันหยุด (วันอาทิตย์)'
      } else {
        status = 'absent'
        badge = 'ขาดงาน / ลืมสแกน'
        absents++
      }

      days.push({
        date: d,
        dateStr,
        att,
        leave,
        isWeekend,
        status,
        badge
      })
    }

    // คำนวณสรุป
    const hasDiligent = (lateMins === 0 && absents === 0 && leavesCount === 0)
    
    setSummary({
      workDaysInMonth: workDaysCount,
      workedDays: worked,
      leaveDays: leavesCount,
      absentDays: absents,
      lateMins: lateMins,
      lateDeduction: lateMins * deductRatePerMin,
      absentDeduction: absents * dailyWage,
      hasDiligentAllowance: hasDiligent
    })

    // เรียงจากล่าสุดไปเก่าสุด
    setCalendarDays(days.reverse())
  }

  const formatThaiDate = (date: Date) => {
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading && !user) return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-12 animate-fade-in">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              📅 ประวัติการลงเวลา
            </h1>
            <p className="text-sm text-slate-500 mt-1">{user?.first_name} {user?.last_name}</p>
          </div>
          <Link href="/liff" className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-bold border border-indigo-100 hover:bg-indigo-100 transition">
            กลับหน้าหลัก
          </Link>
        </div>

        {/* ตัวกรองเดือน-ปี */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
          <span className="text-sm font-bold text-slate-700">ค้นหาตามเดือน-ปี</span>
          <input 
            type="month" 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-indigo-50/50 border border-indigo-100 p-2 rounded-xl text-sm text-indigo-700 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* สิทธิ์เบี้ยขยัน */}
        <div className={`p-4 rounded-2xl border mb-4 relative overflow-hidden ${
          summary.hasDiligentAllowance ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
        }`}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                🏆 สิทธิ์เบี้ยขยันเดือนนี้
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">หมายเหตุ: มีการขาดงานหรือไม่ได้สแกนนิ้ว/บัตร</p>
            </div>
            {summary.hasDiligentAllowance ? (
              <span className="bg-emerald-200 text-emerald-800 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm">✅ มีสิทธิ์รับเบี้ยขยัน</span>
            ) : (
              <span className="bg-rose-200 text-rose-700 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm">❌ หมดสิทธิ์เดือนนี้</span>
            )}
          </div>
        </div>

        {/* สรุป Grid (มาทำงานแล้ว / มาสาย) */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-xs text-slate-500 font-bold mb-2">มาทำงานแล้ว</div>
            <div className="text-3xl font-black text-emerald-600">
              {summary.workedDays} <span className="text-sm text-slate-400 font-normal">/ {summary.workDaysInMonth} วัน</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 font-medium">การลางานรวม {summary.leaveDays} วัน</div>
          </div>
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-xs text-slate-500 font-bold mb-2">มาสาย / ออกก่อนรวม</div>
            <div className="text-3xl font-black text-amber-500">
              {summary.lateMins} <span className="text-sm text-slate-400 font-normal">นาที</span>
            </div>
            <div className="text-[10px] text-rose-500 font-bold mt-2 bg-rose-50 px-2 py-1 rounded inline-block w-fit">
              หักเงินสาย: -฿{summary.lateDeduction.toLocaleString()}
            </div>
          </div>
        </div>

        {/* กล่องสรุปขาดงาน */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="text-xs text-slate-700 font-bold">ขาดงาน / ลืมสแกน</div>
            <div className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded">
              หักเงินขาดงานประมาณ: -฿{summary.absentDeduction.toLocaleString()}
            </div>
          </div>
          <div className="mt-3 text-4xl font-black text-rose-600">
            {summary.absentDays} <span className="text-sm font-normal text-slate-500">วัน</span>
          </div>
          <p className="text-[10px] text-amber-600 mt-3 font-medium flex items-center gap-1">
            <span>*</span> หากมาทำงานแต่ลืมสแกน กรุณาติดต่อ HR เพื่อขออนุมัติปรับเวลา
          </p>
        </div>

        {/* ปฏิทินรายวัน (รายละเอียด) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
             <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800">📜 รายละเอียดการลงเวลาประจำวัน</h3>
             <span className="text-[10px] font-bold text-slate-400">เรียงจากล่าสุด</span>
          </div>
          
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
             {loading ? (
               <div className="p-8 text-center text-slate-400 text-xs">กำลังโหลดข้อมูล...</div>
             ) : calendarDays.length === 0 ? (
               <div className="p-8 text-center text-slate-400 text-xs">ไม่มีข้อมูลในเดือนนี้</div>
             ) : (
               calendarDays.map((day, idx) => (
                 <div key={idx} className={`p-4 flex justify-between items-center transition-colors ${day.status === 'future' ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}>
                   <div>
                     <div className="text-sm font-bold text-slate-800">{formatThaiDate(day.date)}</div>
                     <div className="text-xs text-slate-500 mt-1 font-medium">
                       เข้า: {day.att ? formatTime(day.att.check_in_time) : '-'} • ออก: {day.att ? formatTime(day.att.check_out_time) : '-'}
                     </div>
                   </div>
                   
                   {/* แบดจ์สถานะ */}
                   {day.status === 'absent' && <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-rose-200">{day.badge}</span>}
                   {day.status === 'holiday' && <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-blue-200">{day.badge}</span>}
                   {day.status === 'leave' && <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-purple-200">{day.badge}</span>}
                   {day.status === 'present' && <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-200">{day.badge}</span>}
                   {day.status === 'future' && <span className="text-slate-300 text-[10px] font-bold">{day.badge}</span>}
                 </div>
               ))
             )}
          </div>
        </div>

      </div>
    </div>
  )
}