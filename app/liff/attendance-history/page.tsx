'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LiffAttendanceHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [empInfo, setEmpInfo] = useState<any>(null)
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

  // Summary States
  const [summary, setSummary] = useState({
    workDays: 0,
    presentDays: 0,
    lateMins: 0,
    lateDeduction: 0,
    absentDays: 0,
    absentDeduction: 0,
    leaveDays: 0,
    diligenceEligible: true,
    diligenceReason: ''
  })

  const [dailyLogs, setDailyLogs] = useState<any[]>([])

  useEffect(() => {
    fetchUserDataAndHistory()
  }, [selectedMonth])

  const fetchUserDataAndHistory = async () => {
    setLoading(true)
    try {
      // 1. Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name, company_id, base_salary, daily_rate')
        .eq('auth_id', session.user.id)
        .single()

      if (!userData) return
      setUserId(userData.id)
      setEmpInfo(userData)

      const [year, month] = selectedMonth.split('-').map(Number)
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // 2. Fetch Attendance, Holidays, Leaves, and Settings
      const [attRes, holRes, leaveRes, setRes, leaveTypesRes] = await Promise.all([
        supabase.from('attendance')
          .select('*, work_shifts(*)')
          .eq('user_id', userData.id)
          .gte('action_date', startDateStr)
          .lte('action_date', endDateStr)
          .order('action_date', { ascending: false }),
        
        supabase.from('company_holidays')
          .select('holiday_date, name')
          .eq('company_id', userData.company_id)
          .gte('holiday_date', startDateStr)
          .lte('holiday_date', endDateStr),

        supabase.from('leaves')
          .select('*')
          .eq('user_id', userData.id)
          .eq('status', 'approved')
          .gte('start_date', startDateStr)
          .lte('start_date', endDateStr),

        supabase.from('company_settings')
          .select('*')
          .eq('company_id', userData.company_id)
          .single(),

        supabase.from('leave_types')
          .select('name, deduct_diligence')
          .eq('company_id', userData.company_id)
      ])

      const attendances = attRes.data || []
      const holidays = holRes.data || []
      const leaves = leaveRes.data || []
      const settings = setRes.data
      const leaveTypes = leaveTypesRes.data || []

      const dailyRate = userData.daily_rate || ((userData.base_salary || 0) / 30)

      // 3. Process Attendance Summary
      let presentCount = 0
      let totalLateMins = 0
      let totalLateDeduction = 0
      let absentCount = 0
      let leaveCount = 0
      let hasDiligenceBreach = false
      let breachReason = ''

      const today = new Date()
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      const endDateToCalc = new Date(year, month - 1, lastDay)
      const calcLimitDate = endDateToCalc > yesterday ? yesterday : endDateToCalc

      // Check each day in month for history timeline
      const timeline: any[] = []

      for (let day = 1; day <= lastDay; day++) {
        const d = new Date(year, month - 1, day)
        const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
        
        const hol = holidays.find(h => h.holiday_date === dateStr)
        const leave = leaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date)
        const att = attendances.find(a => a.action_date === dateStr)

        let status = 'normal'
        let statusText = 'ปกติ'
        let badgeColor = 'bg-emerald-100 text-emerald-700'

        if (hol) {
          status = 'holiday'
          statusText = `วันหยุด (${hol.name})`
          badgeColor = 'bg-blue-100 text-blue-700'
        } else if (leave) {
          status = 'leave'
          statusText = `ลา (${leave.leave_type})`
          badgeColor = 'bg-purple-100 text-purple-700'
          if (d <= today) leaveCount++

          // Check if this leave type deducts diligence
          const lt = leaveTypes.find(t => t.name === leave.leave_type)
          if (lt && lt.deduct_diligence !== false) {
            hasDiligenceBreach = true
            breachReason = `มีการ${leave.leave_type}`
          }
        } else if (att) {
          presentCount++
          const late = (att.late_minutes || 0) + (att.early_leave_minutes || 0)
          if (late > 0) {
            status = 'late'
            statusText = `สาย/ออกก่อน ${late} นาที`
            badgeColor = 'bg-amber-100 text-amber-700'
            totalLateMins += late
            totalLateDeduction += att.deduction_amount || 0
            
            hasDiligenceBreach = true
            breachReason = 'มีการเข้าสาย / ออกก่อนเวลา'
          }
        } else if (d <= calcLimitDate) {
          // No scan, no leave, not holiday, and date is in past -> Absent
          status = 'absent'
          statusText = 'ขาดงาน / ลืมสแกน'
          badgeColor = 'bg-rose-100 text-rose-700'
          absentCount++

          hasDiligenceBreach = true
          breachReason = 'มีการขาดงานหรือไม่ได้สแกนนิ้ว/บัตร'
        } else {
          status = 'future'
          statusText = 'ยังไม่ถึงวัน'
          badgeColor = 'bg-slate-100 text-slate-400'
        }

        if (d <= today) {
          timeline.push({
            date: dateStr,
            dayName: d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }),
            checkIn: att?.check_in_time ? new Date(att.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-',
            checkOut: att?.check_out_time ? new Date(att.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-',
            status,
            statusText,
            badgeColor,
            deduction: att?.deduction_amount || 0
          })
        }
      }

      const absentDeduction = absentCount * dailyRate

      setSummary({
        workDays: lastDay - holidays.length,
        presentDays: presentCount,
        lateMins: totalLateMins,
        lateDeduction: totalLateDeduction,
        absentDays: absentCount,
        absentDeduction,
        leaveDays: leaveCount,
        diligenceEligible: !hasDiligenceBreach,
        diligenceReason: breachReason
      })

      setDailyLogs(timeline)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('th-TH', { style: 'decimal', maximumFractionDigits: 0 }).format(val || 0)

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดข้อมูลประวัติ...</div>

  return (
    <div className="min-h-screen bg-slate-50 pb-12 p-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-lg font-black text-slate-800">📅 ประวัติการลงเวลา</h1>
          <p className="text-xs text-slate-500">{empInfo?.first_name} {empInfo?.last_name}</p>
        </div>
        <a href="/liff" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
          กลับหน้าหลัก
        </a>
      </div>

      {/* Month Selector */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-4 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600">ค้นหาตามเดือน-ปี</span>
        <input 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-xs font-bold text-indigo-700 bg-slate-50 p-2 rounded-xl outline-none border border-slate-200 cursor-pointer"
        />
      </div>

      {/* 🏆 Diligence Banner */}
      <div className={`p-4 rounded-2xl border mb-4 shadow-sm ${summary.diligenceEligible ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            🏆 สิทธิ์เบี้ยขยันเดือนนี้
          </span>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${summary.diligenceEligible ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'}`}>
            {summary.diligenceEligible ? '✅ อยู่ในเกณฑ์ได้รับ' : '❌ หมดสิทธิ์เดือนนี้'}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 mt-1">
          {summary.diligenceEligible 
            ? 'ยินดีด้วย! คุณรักษาสถิติ ไม่ขาด ไม่สาย ไม่ลากิจ/ป่วย ได้สมบูรณ์' 
            : `หมายเหตุ: ${summary.diligenceReason}`}
        </p>
      </div>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Present Days */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 mb-1">มาทำงานแล้ว</div>
          <div className="text-xl font-black text-emerald-600">
            {summary.presentDays} <span className="text-xs font-bold text-slate-400">/ {summary.workDays} วัน</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">การลางานรวม {summary.leaveDays} วัน</div>
        </div>

        {/* Late Summary */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 mb-1">มาสาย / ออกก่อนรวม</div>
          <div className="text-xl font-black text-amber-500">
            {summary.lateMins} <span className="text-xs font-bold text-slate-400">นาที</span>
          </div>
          <div className="text-[10px] text-rose-500 font-bold mt-1">
            หักเงินสาย: -฿{formatMoney(summary.lateDeduction)}
          </div>
        </div>

        {/* Absent Summary */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm col-span-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-slate-500">ขาดงาน / ลืมสแกน</span>
            <span className="text-[10px] text-rose-600 font-bold">หักเงินขาดงานประมาณ: -฿{formatMoney(summary.absentDeduction)}</span>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {summary.absentDays} <span className="text-xs font-bold text-slate-400">วัน</span>
          </div>
          {summary.absentDays > 0 && (
            <p className="text-[10px] text-amber-600 font-medium mt-1">
              * หากมาทำงานแต่นึกได้ว่าลืมสแกน กรุณาติดต่อ HR เพื่อขออนุมัติปรับเวลา
            </p>
          )}
        </div>
      </div>

      {/* Daily Attendance Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-700">📜 รายละเอียดการลงเวลาประจำวัน</h2>
          <span className="text-[10px] font-semibold text-slate-400">เรียงจากล่าสุด</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
          {dailyLogs.map((item, idx) => (
            <div key={idx} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <div>
                <div className="font-bold text-xs text-slate-800 mb-0.5">{item.dayName}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>เข้า: <strong className="text-slate-700">{item.checkIn}</strong></span>
                  <span>•</span>
                  <span>ออก: <strong className="text-slate-700">{item.checkOut}</strong></span>
                </div>
              </div>

              <div className="text-right">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold block mb-0.5 ${item.badgeColor}`}>
                  {item.statusText}
                </span>
                {item.deduction > 0 && (
                  <span className="text-[10px] text-rose-500 font-bold block">
                    -{formatMoney(item.deduction)} ฿
                  </span>
                )}
              </div>
            </div>
          ))}

          {dailyLogs.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">ไม่พบประวัติการลงเวลาในเดือนนี้</div>
          )}
        </div>
      </div>
    </div>
  )
}