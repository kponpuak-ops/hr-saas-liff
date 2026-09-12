'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PayrollDetailPage() {
  const params = useParams()
  const router = useRouter()
  const cycleId = params.id

  const [cycle, setCycle] = useState<any>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [payslips, setPayslips] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)

  // State สำหรับดูสลิป
  const [selectedSlip, setSelectedSlip] = useState<any>(null)
  const [slipDetails, setSlipDetails] = useState<any[]>([])
  const [isFetchingSlip, setIsFetchingSlip] = useState(false)

  useEffect(() => {
    fetchData()
  }, [cycleId])

  const fetchData = async () => {
    setIsLoading(true)
    
    const { data: cycleData } = await supabase.from('payroll_cycles').select('*').eq('id', cycleId).single()
    if (!cycleData) {
      alert('ไม่พบข้อมูลรอบเงินเดือน')
      router.push('/payroll')
      return
    }
    setCycle(cycleData)

    const { data: empData } = await supabase
      .from('users')
      .select('id, first_name, last_name, department, position, base_salary, daily_rate, benefits, employee_id')
      .eq('company_id', cycleData.company_id)
      .neq('role', 'super_admin')
      .order('first_name', { ascending: true })

    setEmployees(empData || [])

    const { data: payslipData } = await supabase.from('payslips').select('*').eq('payroll_cycle_id', cycleId)
    setPayslips(payslipData || [])
    
    setIsLoading(false)
  }

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    return Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const calculateLatePenalty = (checkInTime: string, shiftInfo: any, settings: any) => {
    if (!checkInTime || !settings) return 0
    const expectedStartTime = shiftInfo?.start_time || settings.default_start_time
    const buffer = shiftInfo?.late_buffer_minutes ?? settings.late_buffer_minutes ?? 0
    const penaltyRate = shiftInfo?.late_deduction_per_minute ?? settings.late_deduction_per_minute ?? 0

    if (!expectedStartTime || penaltyRate <= 0) return 0
    const checkInDate = new Date(checkInTime)
    const [expHours, expMinutes] = expectedStartTime.split(':').map(Number)
    const expectedDate = new Date(checkInTime)
    expectedDate.setHours(expHours, expMinutes, 0, 0)

    const diffMs = checkInDate.getTime() - expectedDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    return diffMins > buffer ? diffMins * penaltyRate : 0
  }

  const timeToMins = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  const calculateOTBreakdown = (otRequest: any, attendance: any, shiftInfo: any, settings: any, isHoliday: boolean) => {
    if (!otRequest || !attendance || !attendance.check_out_time || !attendance.check_in_time) {
        return { normal: 0, holidayWork: 0, holidayOt: 0 };
    }

    const useShift = settings.has_shifts;
    const normStartStr = useShift && shiftInfo ? shiftInfo.start_time : settings.default_start_time;
    const normEndStr = useShift && shiftInfo ? shiftInfo.end_time : settings.default_end_time;
    const normStart = timeToMins(normStartStr);
    const normEnd = timeToMins(normEndStr);

    const otReqStart = timeToMins(otRequest.start_time);
    const otReqEnd = timeToMins(otRequest.end_time);

    const checkInDate = new Date(attendance.check_in_time);
    const checkOutDate = new Date(attendance.check_out_time);
    const attStart = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    const attEnd = checkOutDate.getHours() * 60 + checkOutDate.getMinutes();

    let actualAttEnd = attEnd < attStart ? attEnd + 1440 : attEnd;
    let actualOtReqEnd = otReqEnd < otReqStart ? otReqEnd + 1440 : otReqEnd;
    let actualNormEnd = normEnd < normStart ? normEnd + 1440 : normEnd;

    const validStart = Math.max(otReqStart, attStart);
    const validEnd = Math.min(actualOtReqEnd, actualAttEnd);
    if (validStart >= validEnd) return { normal: 0, holidayWork: 0, holidayOt: 0 };
    const totalValidMins = validEnd - validStart;

    const inStart = Math.max(validStart, normStart);
    const inEnd = Math.min(validEnd, actualNormEnd);
    let insideMins = inStart < inEnd ? inEnd - inStart : 0;
    const outsideMins = totalValidMins - insideMins;

    const insideHours = insideMins / 60;
    const outsideHours = outsideMins / 60;

    if (isHoliday) {
        return { normal: 0, holidayWork: insideHours, holidayOt: outsideHours };
    } else {
        return { normal: insideHours + outsideHours, holidayWork: 0, holidayOt: 0 };
    }
  }

  const handleCalculateAll = async () => {
    if (!confirm('ยืนยันการเริ่มประมวลผลคำนวณเงินเดือนพนักงานทุกคน?')) return
    setIsCalculating(true)

    try {
      const { data: settings } = await supabase.from('company_settings').select('*').eq('company_id', cycle.company_id).single()

      const ssEnabled = settings?.ss_enabled ?? true
      const ssRate = (settings?.ss_employee_rate ?? 5) / 100
      const ssMin = settings?.ss_min_salary ?? 1650
      const ssMax = settings?.ss_max_salary ?? 15000

      const otRateNormal = settings?.ot_rate_normal ?? 1.5
      const otRateHolidayWork = settings?.ot_rate_holiday_work ?? 2.0
      const otRateHolidayOt = settings?.ot_rate_holiday_ot ?? 3.0

      const { data: holidays } = await supabase
        .from('company_holidays')
        .select('holiday_date')
        .eq('company_id', cycle.company_id)
        .gte('holiday_date', cycle.start_date)
        .lte('holiday_date', cycle.end_date)
      
      const holidayDates = holidays?.map(h => h.holiday_date) || []
      const { data: leaveTypesData } = await supabase.from('leave_types').select('*').eq('company_id', cycle.company_id)

      const { data: approvedOts } = await supabase
        .from('ot_requests')
        .select('*, users!user_id!inner(company_id)')
        .eq('users.company_id', cycle.company_id)
        .eq('status', 'approved')
        .gte('request_date', cycle.start_date)
        .lte('request_date', cycle.end_date)

      const { data: attendances } = await supabase
        .from('attendance')
        .select('*, work_shifts(shift_name, start_time, end_time, late_buffer_minutes, late_deduction_per_minute), users!user_id!inner(company_id)')
        .eq('users.company_id', cycle.company_id)
        .gte('action_date', cycle.start_date)
        .lte('action_date', cycle.end_date)

      const cycleYear = new Date(cycle.start_date).getFullYear()
      const { data: allApprovedLeaves } = await supabase
        .from('leaves')
        .select('*, users!user_id!inner(company_id)')
        .eq('users.company_id', cycle.company_id)
        .eq('status', 'approved')
        .gte('start_date', `${cycleYear}-01-01`)
        .lte('start_date', `${cycleYear}-12-31`)

      for (const emp of employees) {
        const baseSalary = emp.base_salary || 0
        const dailyRate = emp.daily_rate || (baseSalary / 30)
        const hourlyRate = dailyRate / 8

        const empAttendances = attendances?.filter(att => att.user_id === emp.id) || []
        
        // -- คำนวณ OT --
        const empOts = approvedOts?.filter(ot => ot.user_id === emp.id) || []
        let otHoursNormal = 0
        let otHoursHolidayWork = 0
        let otHoursHolidayOt = 0

        empOts.forEach(ot => { 
          const matchedAttendance = empAttendances.find(att => att.action_date === ot.request_date);
          if(matchedAttendance) {
             const isHoliday = holidayDates.includes(ot.request_date);
             const breakdown = calculateOTBreakdown(ot, matchedAttendance, matchedAttendance.work_shifts, settings, isHoliday);
             
             otHoursNormal += breakdown.normal;
             otHoursHolidayWork += breakdown.holidayWork;
             otHoursHolidayOt += breakdown.holidayOt;
          }
        })
        
        const otEarningsNormal = otHoursNormal * hourlyRate * otRateNormal
        const otEarningsHolidayWork = otHoursHolidayWork * hourlyRate * otRateHolidayWork
        const otEarningsHolidayOt = otHoursHolidayOt * hourlyRate * otRateHolidayOt
        
        // -- คำนวณสวัสดิการ --
        let totalBenefitAmount = 0;
        let benefitDetails: any[] = [];
        
        if (emp.benefits && Array.isArray(emp.benefits)) {
            emp.benefits.forEach((benefit: any) => {
                const amt = Number(benefit.amount) || 0;
                if (amt > 0) {
                    totalBenefitAmount += amt;
                    benefitDetails.push({ name: benefit.name, amount: amt });
                }
            });
        }

        const totalEarnings = otEarningsNormal + otEarningsHolidayWork + otEarningsHolidayOt + totalBenefitAmount;

        // -- คำนวณหักมาสาย --
        let lateDeductionTotal = 0
        empAttendances.forEach(att => {
          lateDeductionTotal += calculateLatePenalty(att.check_in_time, att.work_shifts, settings)
        })

        // -- คำนวณวันลา --
        const empAllLeaves = allApprovedLeaves?.filter(l => l.user_id === emp.id) || []
        const leavesInCycle = empAllLeaves.filter(l => l.start_date >= cycle.start_date && l.start_date <= cycle.end_date)
        const leavesBeforeCycle = empAllLeaves.filter(l => l.start_date < cycle.start_date)

        let leaveDaysToDeduct = 0
        let leaveDeductionDetails: any[] = []
        const usageBefore: Record<string, number> = {}
        
        leavesBeforeCycle.forEach(l => {
           usageBefore[l.leave_type] = (usageBefore[l.leave_type] || 0) + calculateDays(l.start_date, l.end_date)
        })

        leavesInCycle.forEach(l => { 
          const days = calculateDays(l.start_date, l.end_date)
          const leaveSetting = leaveTypesData?.find(lt => lt.name === l.leave_type)
          if (!leaveSetting) return;

          if (leaveSetting.is_paid_for_monthly === false) {
            leaveDaysToDeduct += days
            leaveDeductionDetails.push({ name: l.leave_type, days: days, amount: days * dailyRate })
          } else {
            const maxDays = leaveSetting.max_paid_days || 0
            if (maxDays < 999) {
                const usedBefore = usageBefore[l.leave_type] || 0
                usageBefore[l.leave_type] = usedBefore + days

                if (usedBefore + days > maxDays) {
                    const excessDays = usedBefore >= maxDays ? days : (usedBefore + days - maxDays)
                    leaveDaysToDeduct += excessDays
                    leaveDeductionDetails.push({ name: `${l.leave_type} (เกินสิทธิ์)`, days: excessDays, amount: excessDays * dailyRate })
                }
            }
          }
        })
        const leaveDeductions = leaveDaysToDeduct * dailyRate

        // -- คำนวณประกันสังคม --
        let ssoDeduction = 0
        if (ssEnabled) {
          const ssoBase = baseSalary > ssMax ? ssMax : (baseSalary < ssMin ? 0 : baseSalary)
          ssoDeduction = ssoBase > 0 ? (ssoBase * ssRate) : 0
        }

        // -- สรุปยอดสุทธิ --
        const totalDeductions = leaveDeductions + ssoDeduction + lateDeductionTotal
        const netPay = baseSalary + totalEarnings - totalDeductions

        // 7. บันทึก/อัปเดตลงตาราง payslips
        const existingSlip = payslips.find(p => p.user_id === emp.id)
        let slipId = existingSlip?.id

        if (existingSlip) {
          await supabase.from('payslips').update({
            base_salary: baseSalary,
            total_earnings: totalEarnings,
            total_deductions: totalDeductions,
            net_pay: netPay
          }).eq('id', slipId)
        } else {
          const { data: newSlip } = await supabase.from('payslips').insert([{
            payroll_cycle_id: cycleId,
            user_id: emp.id,
            company_id: cycle.company_id,
            base_salary: baseSalary,
            total_earnings: totalEarnings,
            total_deductions: totalDeductions,
            net_pay: netPay,
            status: 'draft'
          }]).select().single()
          if (newSlip) slipId = newSlip.id
        }

        // 8. บันทึกรายละเอียดสลิปย่อย (payslip_details)
        if (slipId) {
          await supabase.from('payslip_details').delete().eq('payslip_id', slipId)
          
          let details = []
          if (otEarningsNormal > 0) details.push({ payslip_id: slipId, type: 'earning', item_name: `OT วันปกติ (${otRateNormal}x) ${otHoursNormal.toFixed(1)} ชม.`, amount: otEarningsNormal })
          if (otEarningsHolidayWork > 0) details.push({ payslip_id: slipId, type: 'earning', item_name: `ทำงานวันหยุด (${otRateHolidayWork}x) ${otHoursHolidayWork.toFixed(1)} ชม.`, amount: otEarningsHolidayWork })
          if (otEarningsHolidayOt > 0) details.push({ payslip_id: slipId, type: 'earning', item_name: `OT วันหยุด (${otRateHolidayOt}x) ${otHoursHolidayOt.toFixed(1)} ชม.`, amount: otEarningsHolidayOt })
          
          benefitDetails.forEach(bd => {
            details.push({ payslip_id: slipId, type: 'earning', item_name: bd.name, amount: bd.amount })
          })
          
          leaveDeductionDetails.forEach(ld => {
            details.push({ payslip_id: slipId, type: 'deduction', item_name: `หัก${ld.name} ${ld.days} วัน`, amount: ld.amount })
          })

          if (lateDeductionTotal > 0) details.push({ payslip_id: slipId, type: 'deduction', item_name: `หักมาสาย`, amount: lateDeductionTotal })
          if (ssoDeduction > 0) details.push({ payslip_id: slipId, type: 'deduction', item_name: `ประกันสังคม (${(ssRate * 100).toFixed(1)}%)`, amount: ssoDeduction })

          if (details.length > 0) await supabase.from('payslip_details').insert(details)
        }
      }

      await supabase.from('payroll_cycles').update({ status: 'processing' }).eq('id', cycleId)
      alert('✅ ประมวลผลเงินเดือนเสร็จสิ้น!')
      fetchData()
    } catch (error) {
      console.error(error)
      alert('เกิดข้อผิดพลาดในการคำนวณ')
    }
    
    setIsCalculating(false)
  }

  const handlePublishPayroll = async () => {
    if (!confirm('ยืนยันการปิดรอบบิลและเผยแพร่สลิปเงินเดือน?\n\nข้อควรระวัง:\n- พนักงานทุกคนจะสามารถดูสลิปนี้ได้ทันที\n- คุณจะไม่สามารถกดประมวลผลคำนวณเงินเดือนใหม่ได้อีก')) return
    setIsCalculating(true)

    try {
      await supabase.from('payslips').update({ status: 'approved' }).eq('payroll_cycle_id', cycleId)
      await supabase.from('payroll_cycles').update({ status: 'completed' }).eq('id', cycleId)

      alert('✅ เผยแพร่สลิปเงินเดือนเรียบร้อยแล้ว พนักงานสามารถตรวจสอบสลิปได้ทันที!')
      fetchData()
    } catch (error) {
      console.error(error)
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    }
    
    setIsCalculating(false)
  }

  // 💡 ฟังก์ชันปลดล็อกรอบบิล
  const handleUnlockPayroll = async () => {
    if (!confirm('🔓 ยืนยันการปลดล็อกรอบบิล?\n\nข้อควรระวัง:\n- สลิปของพนักงานจะถูกซ่อนกลับเป็นสถานะ "ร่าง (Draft)"\n- คุณจะต้องกดประมวลผลและเผยแพร่ใหม่อีกครั้งหลังจากแก้ไขเสร็จ')) return
    setIsCalculating(true)

    try {
      // 1. ดึงสลิปกลับเป็น draft
      await supabase.from('payslips').update({ status: 'draft' }).eq('payroll_cycle_id', cycleId)
      
      // 2. เปลี่ยนสถานะรอบบิลกลับเป็น processing
      await supabase.from('payroll_cycles').update({ status: 'processing' }).eq('id', cycleId)

      alert('🔓 ปลดล็อกรอบบิลเรียบร้อยแล้ว คุณสามารถแก้ไขและกดประมวลผลใหม่ได้เลย')
      fetchData()
    } catch (error) {
      console.error(error)
      alert('เกิดข้อผิดพลาดในการปลดล็อก')
    }
    
    setIsCalculating(false)
  }

  const handleViewSlip = async (slip: any, emp: any) => {
    setIsFetchingSlip(true)
    setSelectedSlip({ ...slip, employee: emp })
    
    const { data } = await supabase
      .from('payslip_details')
      .select('*')
      .eq('payslip_id', slip.id)
      .order('id', { ascending: true })
      
    setSlipDetails(data || [])
    setIsFetchingSlip(false)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)
  }

  if (isLoading) return <div className="p-6 text-slate-500">กำลังโหลดข้อมูล...</div>

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4 print:hidden">
        <div>
          <button onClick={() => router.push('/payroll')} className="text-sm font-bold text-slate-400 hover:text-indigo-600 mb-2 transition-colors">
            ← กลับไปหน้ารวมรอบบิล
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{cycle?.name}</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            รอบการคำนวณ: <span className="text-slate-700 font-bold">{formatDate(cycle?.start_date)} - {formatDate(cycle?.end_date)}</span> | 
            จ่ายเงิน: <span className="text-indigo-600 font-bold">{formatDate(cycle?.payment_date)}</span>
          </p>
        </div>
        
        {/* 💡 อัปเดตปุ่มจัดการด้านบนให้รองรับระบบ Unlock */}
        <div className="flex gap-3">
          {cycle?.status !== 'completed' && (
            <button 
              onClick={handleCalculateAll}
              disabled={isCalculating}
              className={`px-4 py-2 text-white font-bold rounded-lg shadow-sm transition-colors ${isCalculating ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {isCalculating ? '⏳ กำลังคำนวณ...' : '⚡ ประมวลผลเงินเดือน'}
            </button>
          )}
          
          {cycle?.status !== 'completed' && payslips.length > 0 && (
            <button 
              onClick={handlePublishPayroll}
              disabled={isCalculating}
              className={`px-4 py-2 text-white font-bold rounded-lg shadow-sm transition-colors ${isCalculating ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              ✅ ยืนยันและเผยแพร่สลิป
            </button>
          )}

          {cycle?.status === 'completed' && (
            <div className="flex items-center gap-2">
              <span className="px-5 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg border border-slate-200 flex items-center gap-2">
                🔒 ปิดรอบบิลและเผยแพร่แล้ว
              </span>
              <button 
                onClick={handleUnlockPayroll}
                disabled={isCalculating}
                className="px-4 py-2 text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 font-bold rounded-lg shadow-sm transition-colors text-sm"
              >
                🔓 ปลดล็อกแก้ไข
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
              <th className="p-4 font-bold">ชื่อพนักงาน</th>
              <th className="p-4 font-bold text-right">ฐานเงินเดือน</th>
              <th className="p-4 font-bold text-right text-emerald-600">+ รายได้เพิ่ม</th>
              <th className="p-4 font-bold text-right text-rose-600">- รายการหัก</th>
              <th className="p-4 font-bold text-right text-indigo-700">รับสุทธิ (Net Pay)</th>
              <th className="p-4 font-bold text-center">สถานะ</th>
              <th className="p-4 font-bold text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => {
              const slip = payslips.find(p => p.user_id === emp.id)
              
              return (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{emp.first_name} {emp.last_name}</div>
                    <div className="text-xs text-slate-500">{emp.department} • {emp.position || 'ไม่ระบุตำแหน่ง'}</div>
                  </td>
                  <td className="p-4 text-right text-sm font-medium text-slate-600">฿{formatMoney(emp.base_salary)}</td>
                  <td className="p-4 text-right text-sm font-bold text-emerald-600">
                    {slip?.total_earnings > 0 ? `+฿${formatMoney(slip.total_earnings)}` : '-'}
                  </td>
                  <td className="p-4 text-right text-sm font-bold text-rose-500">
                    {slip?.total_deductions > 0 ? `-฿${formatMoney(slip.total_deductions)}` : '-'}
                  </td>
                  <td className="p-4 text-right text-base font-extrabold text-indigo-700 bg-indigo-50/50">
                    {slip ? `฿${formatMoney(slip.net_pay)}` : `฿${formatMoney(0)}`}
                  </td>
                  <td className="p-4 text-center">
                    {!slip ? <span className="text-xs font-bold text-slate-400">ยังไม่คำนวณ</span> : 
                      slip.status === 'draft' ? <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">ร่าง (Draft)</span> :
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">✅ อนุมัติแล้ว</span>
                    }
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      disabled={!slip} 
                      onClick={() => handleViewSlip(slip, emp)}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                    >
                      ดูสลิป ➔
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 🧾 Modal ใบแจ้งเงินเดือน (Payslip) */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:absolute print:inset-0 print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:max-w-full print:shadow-none print:h-auto print:max-h-full print:rounded-none">
            
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden">
              <h2 className="text-lg font-bold text-slate-800">📄 ใบแจ้งเงินเดือน (Payslip)</h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
                  🖨️ พิมพ์สลิป
                </button>
                <button onClick={() => setSelectedSlip(null)} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-bold transition-colors">
                  ✕ ปิด
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto print:overflow-visible print:p-8">
              {isFetchingSlip ? (
                <div className="text-center py-10 text-slate-500">กำลังโหลดรายละเอียดสลิป...</div>
              ) : (
                <div className="border border-slate-300 p-6 rounded-lg bg-white">
                  
                  {/* Header Slip */}
                  <div className="text-center mb-6 border-b border-slate-300 pb-4">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">ใบแจ้งเงินเดือน (PAYSLIP)</h2>
                    <p className="text-slate-600 font-bold mt-1">{cycle?.name}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      รอบการคำนวณ: {formatDate(cycle?.start_date)} - {formatDate(cycle?.end_date)} | จ่ายเงิน: {formatDate(cycle?.payment_date)}
                    </p>
                  </div>

                  {/* Employee Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                      <p><span className="font-bold text-slate-600 inline-block w-24">รหัสพนักงาน:</span> {selectedSlip.employee?.employee_id || '-'}</p>
                      <p className="mt-1"><span className="font-bold text-slate-600 inline-block w-24">ชื่อ-สกุล:</span> {selectedSlip.employee?.first_name} {selectedSlip.employee?.last_name}</p>
                    </div>
                    <div>
                      <p><span className="font-bold text-slate-600 inline-block w-24">แผนก:</span> {selectedSlip.employee?.department || '-'}</p>
                      <p className="mt-1"><span className="font-bold text-slate-600 inline-block w-24">ตำแหน่ง:</span> {selectedSlip.employee?.position || '-'}</p>
                    </div>
                  </div>

                  {/* 2 Columns: Earnings & Deductions */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-300 pt-4">
                    
                    {/* ฝั่งรายได้ (Earnings) */}
                    <div>
                      <h3 className="font-black text-slate-800 border-b-2 border-slate-800 pb-1 mb-3">รายได้ (Earnings)</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-700">เงินเดือนพื้นฐาน</span>
                          <span className="font-medium text-slate-800">{formatMoney(selectedSlip.base_salary)}</span>
                        </div>
                        {slipDetails.filter(d => d.type === 'earning').map(item => (
                          <div key={item.id} className="flex justify-between">
                            <span className="text-slate-700">{item.item_name}</span>
                            <span className="font-medium text-emerald-600">{formatMoney(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ฝั่งรายการหัก (Deductions) */}
                    <div>
                      <h3 className="font-black text-slate-800 border-b-2 border-slate-800 pb-1 mb-3">รายการหัก (Deductions)</h3>
                      <div className="space-y-2 text-sm">
                        {slipDetails.filter(d => d.type === 'deduction').map(item => (
                          <div key={item.id} className="flex justify-between">
                            <span className="text-slate-700">{item.item_name}</span>
                            <span className="font-medium text-rose-600">{formatMoney(item.amount)}</span>
                          </div>
                        ))}
                        {slipDetails.filter(d => d.type === 'deduction').length === 0 && (
                          <div className="text-slate-400 italic">ไม่มีรายการหัก</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-2 gap-x-6 mt-6 border-t border-slate-300 pt-4 font-bold text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-800">รวมรายได้ (Total Earnings)</span>
                      <span className="text-emerald-700">{formatMoney(selectedSlip.base_salary + selectedSlip.total_earnings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-800">รวมรายการหัก (Total Deductions)</span>
                      <span className="text-rose-700">{formatMoney(selectedSlip.total_deductions)}</span>
                    </div>
                  </div>

                  {/* Net Pay */}
                  <div className="mt-6 border-2 border-slate-800 bg-slate-50 p-4 rounded-lg flex justify-between items-center">
                    <span className="text-lg font-black text-slate-800 uppercase tracking-wide">รายรับสุทธิ (Net Pay)</span>
                    <span className="text-2xl font-black text-indigo-700">{formatMoney(selectedSlip.net_pay)}</span>
                  </div>

                  {/* Signatures */}
                  <div className="mt-12 grid grid-cols-2 gap-8 text-center text-sm print:mt-20">
                    <div>
                      <div className="border-b border-slate-400 w-48 mx-auto mb-2"></div>
                      <p className="text-slate-600">ผู้จ่ายเงิน (Authorized Signature)</p>
                    </div>
                    <div>
                      <div className="border-b border-slate-400 w-48 mx-auto mb-2"></div>
                      <p className="text-slate-600">ผู้รับเงิน (Employee Signature)</p>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}