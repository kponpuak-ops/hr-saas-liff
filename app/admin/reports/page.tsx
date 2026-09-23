'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts'

export default function ManagementReportPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [companyPackage, setCompanyPackage] = useState<string>('free')
  
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })

  const [kpis, setKpis] = useState({
    totalEmployees: 0,
    diligenceCount: 0,
    totalAbsentDays: 0,
    totalLateMins: 0,
    totalBaseSalary: 0,
    totalOtCost: 0,
    totalDiligence: 0,
    totalOtherBenefits: 0,
    totalDeductions: 0,
    netPay: 0,
    hasPayroll: false // เช็คว่าเดือนนี้มีการทำเงินเดือนหรือยัง
  })
  
  const [deptStats, setDeptStats] = useState<any[]>([])

  useEffect(() => {
    fetchReportData()
  }, [filterMonth])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userAuth } = await supabase.from('users').select('company_id').eq('auth_id', session.user.id).single()
      if (!userAuth?.company_id) return
      const cId = userAuth.company_id
      setCompanyId(cId)

      const { data: compData } = await supabase.from('companies').select('package_tier').eq('id', cId).single()
      let currentPackage = 'free'
      if (compData && compData.package_tier) {
        currentPackage = compData.package_tier.replace(/"/g, '').toLowerCase()
        setCompanyPackage(currentPackage)
      }

      if (!['trial', 'pro'].includes(currentPackage)) {
        setLoading(false)
        return
      }

      const [year, month] = filterMonth.split('-').map(Number)
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0)
      const endDateStr = endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

      // 1. ดึงข้อมูลพื้นฐาน (พนักงาน, เวลา, ลา, วันหยุด) สำหรับหาสถิติสาย/ขาดงาน
      const [empRes, attRes, holRes, leaveRes] = await Promise.all([
        supabase.from('users').select('id, first_name, last_name, department, base_salary').eq('company_id', cId).neq('role', 'super_admin'),
        supabase.from('attendance').select('user_id, action_date, late_minutes, early_leave_minutes').eq('company_id', cId).gte('action_date', startDateStr).lte('action_date', endDateStr),
        supabase.from('company_holidays').select('holiday_date').eq('company_id', cId).gte('holiday_date', startDateStr).lte('holiday_date', endDateStr),
        supabase.from('leaves').select('user_id, start_date, end_date').eq('company_id', cId).eq('status', 'approved').lte('start_date', endDateStr).gte('end_date', startDateStr)
      ])

      const employees = empRes.data || []
      const attendances = attRes.data || []
      const holidays = holRes.data?.map(h => h.holiday_date) || []
      const leaves = leaveRes.data || []

      // 💡 2. ดึงข้อมูล "สลิปเงินเดือน" ที่ประมวลผลแล้วในเดือนนี้
      const { data: cycles } = await supabase.from('payroll_cycles')
        .select('id')
        .eq('company_id', cId)
        .gte('end_date', startDateStr)
        .lte('end_date', endDateStr)

      const cycleIds = cycles?.map(c => c.id) || []
      let payslips: any[] = []
      let slipDetails: any[] = []
      
      if (cycleIds.length > 0) {
        const { data: pData } = await supabase.from('payslips').select('*').in('payroll_cycle_id', cycleIds)
        payslips = pData || []
        
        if (payslips.length > 0) {
          const pIds = payslips.map(p => p.id)
          const { data: dData } = await supabase.from('payslip_details').select('*').in('payslip_id', pIds)
          slipDetails = dData || []
        }
      }

      // 3. ประมวลผลและสรุปข้อมูล
      let sumBase = 0, sumOt = 0, sumDiligence = 0, sumOtherBen = 0, sumDeduct = 0, sumNet = 0;
      let totalLate = 0, totalAbsent = 0, countDiligence = 0;
      const deptMap: Record<string, any> = {}

      const today = new Date()
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      const calcEndDate = endDate > yesterday ? yesterday : endDate // นับขาดงานถึงแค่เมื่อวาน

      employees.forEach(emp => {
        const dept = emp.department || 'ไม่ระบุแผนก'
        if (!deptMap[dept]) {
          deptMap[dept] = { name: dept, empCount: 0, salaryCost: 0, otCost: 0, diligenceCost: 0, deductCost: 0, absentDays: 0, lateMins: 0 }
        }
        deptMap[dept].empCount += 1

        // --- สถิติการปฏิบัติงาน (Operational Stats) ---
        const empAtts = attendances.filter(a => a.user_id === emp.id)
        let empLate = 0;
        empAtts.forEach(a => empLate += (a.late_minutes || 0) + (a.early_leave_minutes || 0))
        
        let empAbsent = 0;
        for (let d = new Date(`${startDateStr}T00:00:00`); d <= calcEndDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
          const isHol = holidays.includes(dateStr)
          const hasLeave = leaves.some(l => l.user_id === emp.id && dateStr >= l.start_date && dateStr <= l.end_date)
          const hasScanned = empAtts.some(a => a.action_date === dateStr)
          
          if (!isHol && !hasLeave && !hasScanned) empAbsent++
        }

        totalLate += empLate
        totalAbsent += empAbsent
        deptMap[dept].lateMins += empLate
        deptMap[dept].absentDays += empAbsent

        // --- สถิติการเงิน (Financial Stats จาก Payroll) ---
        let empBase = 0, empOt = 0, empDiligence = 0, empOther = 0, empDeduct = 0, empNet = 0;
        
        const empSlip = payslips.find(p => p.user_id === emp.id)
        if (empSlip) {
          empBase = empSlip.base_salary || 0
          empNet = empSlip.net_pay || 0
          empDeduct = empSlip.total_deductions || 0

          const details = slipDetails.filter(d => d.payslip_id === empSlip.id)
          details.forEach(d => {
            if (d.type === 'earning') {
              if (d.item_name.includes('OT') || d.item_name.includes('ทำงานวันหยุด')) {
                empOt += d.amount
              } else if (d.item_name.includes('เบี้ยขยัน (ขั้น')) {
                empDiligence += d.amount
                if (d.amount > 0) countDiligence++ // นับพนักงานที่ได้รับเบี้ยขยัน
              } else {
                empOther += d.amount
              }
            }
          })
        }

        sumBase += empBase
        sumOt += empOt
        sumDiligence += empDiligence
        sumOtherBen += empOther
        sumDeduct += empDeduct
        sumNet += empNet

        deptMap[dept].salaryCost += empBase
        deptMap[dept].otCost += empOt
        deptMap[dept].diligenceCost += empDiligence
        deptMap[dept].deductCost += empDeduct
      })

      setKpis({
        totalEmployees: employees.length,
        diligenceCount: countDiligence,
        totalAbsentDays: totalAbsent,
        totalLateMins: totalLate,
        totalBaseSalary: sumBase,
        totalOtCost: sumOt,
        totalDiligence: sumDiligence,
        totalOtherBenefits: sumOtherBen,
        totalDeductions: sumDeduct,
        netPay: sumNet,
        hasPayroll: payslips.length > 0
      })

      setDeptStats(Object.values(deptMap))

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'decimal', maximumFractionDigits: 0 }).format(amount || 0)

  // ข้อมูลกราฟโดนัท (แยกสัดส่วนชัดเจน)
  const payrollPieData = [
    { name: 'ฐานเงินเดือน', value: kpis.totalBaseSalary, fill: '#6366f1' },
    { name: 'ค่าล่วงเวลา (OT)', value: kpis.totalOtCost, fill: '#10b981' },
    { name: 'เบี้ยขยัน', value: kpis.totalDiligence, fill: '#f59e0b' },
    { name: 'สวัสดิการอื่นๆ', value: kpis.totalOtherBenefits, fill: '#8b5cf6' },
  ].filter(d => d.value > 0)

  if (loading) return <div className="p-10 text-center text-slate-500">กำลังประมวลผลข้อมูลรายงาน...</div>

  const isPro = ['trial', 'pro'].includes(companyPackage)
  if (!isPro) {
    return (
      <div className="pb-10 p-6 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center max-w-md w-full">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-xl font-bold text-slate-800 mb-3">ฟีเจอร์นี้เฉพาะแพ็กเกจ PRO</h1>
          <p className="text-sm text-slate-500 mb-8">
            รายงานเชิงลึกสำหรับผู้บริหาร (Management Report) เพื่อวิเคราะห์ภาพรวมต้นทุน ประสิทธิภาพ และสถิติรายแผนก สงวนสิทธิ์ไว้สำหรับแพ็กเกจ Trial และ PRO เท่านั้น
          </p>
          <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all">
            ติดต่ออัปเกรดแพ็กเกจ 🚀
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-10 max-w-7xl mx-auto animate-fade-in p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">📊 รายงานผู้บริหาร (Management Report)</h1>
          <p className="text-slate-500 text-sm mt-1">สรุปข้อมูลต้นทุนเงินเดือน ประสิทธิภาพพนักงาน และสถิติรายแผนก (ข้อมูลจาก Payroll)</p>
        </div>
        
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <span className="bg-slate-50 px-4 py-2 text-slate-600 text-sm font-bold border-r border-slate-200">
            📅 เลือกเดือน:
          </span>
          <input 
            type="month"
            value={filterMonth}
            max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="p-2 px-4 text-sm text-slate-700 outline-none font-bold cursor-pointer hover:bg-slate-50 transition"
          />
        </div>
      </div>

      {!kpis.hasPayroll && (
        <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-xl flex items-center gap-3 shadow-sm">
          <span className="text-xl">💡</span>
          <div className="text-sm">
            <strong className="block">ข้อมูลการเงินยังเป็น 0</strong>
            ข้อมูลต้นทุนเงินเดือนและกราฟโครงสร้าง จะแสดงผลก็ต่อเมื่อ HR ได้ทำการ <b>"ประมวลผลเงินเดือน (Payroll)"</b> ของเดือนนี้เรียบร้อยแล้ว
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">💰 ภาพรวมต้นทุนและประสิทธิภาพพนักงาน</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ยอดจ่ายเงินเดือนสุทธิ (Net Pay)</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-indigo-700">{formatMoney(kpis.netPay)}</span>
            <span className="text-sm font-bold text-indigo-400">บาท</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 font-medium flex flex-wrap gap-x-3 gap-y-1">
            <span>ฐานเงินเดือน: {formatMoney(kpis.totalBaseSalary)} ฿</span>
            <span className="text-emerald-600">OT: +{formatMoney(kpis.totalOtCost)} ฿</span>
            <span className="text-emerald-600">เบี้ยขยัน: +{formatMoney(kpis.totalDiligence)} ฿</span>
            <span className="text-rose-500">หักรวม: -{formatMoney(kpis.totalDeductions)} ฿</span>
          </div>
        </div>

        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 flex justify-between">
            <span>ได้รับเบี้ยขยัน</span>
            <span>🏆</span>
          </div>
          <div className="text-3xl font-black text-emerald-700">{kpis.diligenceCount} <span className="text-sm font-bold text-emerald-500">คน</span></div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">จากผลงาน Payroll เดือนนี้</div>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-center">
          <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 flex justify-between">
            <span>พนักงานมาสาย</span>
            <span>⏰</span>
          </div>
          <div className="text-3xl font-black text-amber-700">{formatMoney(kpis.totalLateMins)} <span className="text-sm font-bold text-amber-500">นาที</span></div>
          <div className="text-[10px] text-amber-600 font-medium mt-1">เวลาสูญเสียรวมทั้งบริษัท</div>
        </div>

        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-center">
          <div className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1 flex justify-between">
            <span>ยอดการขาดงาน</span>
            <span>❌</span>
          </div>
          <div className="text-3xl font-black text-rose-700">{kpis.totalAbsentDays} <span className="text-sm font-bold text-rose-500">วัน</span></div>
          <div className="text-[10px] text-rose-600 font-medium mt-1">รวมจากพนักงานทั้งหมด</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1">
          <h3 className="text-sm font-bold text-slate-800 mb-4">โครงสร้างต้นทุนเงินเดือน (Payroll Structure)</h3>
          <div className="h-64 w-full">
            {payrollPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={payrollPieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {payrollPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${formatMoney(Number(value) || 0)} บาท`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex flex-col h-full items-center justify-center text-slate-400 text-sm"><span>ไม่มีข้อมูลต้นทุน</span><span className="text-xs mt-1">รอการทำ Payroll</span></div>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-800 mb-4">สถิติวันขาดงาน และ เวลาสาย (แยกรายแผนก)</h3>
          <div className="h-64 w-full">
            {deptStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px' }} />
                  <Bar yAxisId="left" dataKey="absentDays" name="ขาดงาน (วัน)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar yAxisId="right" dataKey="lateMins" name="มาสาย (นาที)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูล</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800">📊 ตารางสรุปข้อมูลแยกตามแผนก (Department Breakdown)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <th className="px-6 py-4">แผนก</th>
                <th className="px-6 py-4 text-center">จำนวนคน</th>
                <th className="px-6 py-4 text-right">ฐานเงินเดือน (฿)</th>
                <th className="px-6 py-4 text-right text-emerald-600">ค่า OT (฿)</th>
                <th className="px-6 py-4 text-right text-amber-600">เบี้ยขยัน (฿)</th>
                <th className="px-6 py-4 text-right text-rose-600">หักรวม (฿)</th>
                <th className="px-6 py-4 text-center text-amber-600">สายรวม (นาที)</th>
                <th className="px-6 py-4 text-center text-rose-600">ขาดงาน (วัน)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptStats.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">ไม่มีข้อมูลในเดือนที่เลือก</td></tr>
              ) : (
                [...deptStats].sort((a, b) => b.salaryCost - a.salaryCost).map((dept, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{dept.name}</td>
                    <td className="px-6 py-4 text-center font-medium text-slate-600">{dept.empCount}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">{formatMoney(dept.salaryCost)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">+{formatMoney(dept.otCost)}</td>
                    <td className="px-6 py-4 text-right font-bold text-amber-500">+{formatMoney(dept.diligenceCost)}</td>
                    <td className="px-6 py-4 text-right font-bold text-rose-500">-{formatMoney(dept.deductCost)}</td>
                    <td className="px-6 py-4 text-center font-bold text-amber-600">{formatMoney(dept.lateMins)}</td>
                    <td className="px-6 py-4 text-center font-bold text-rose-600">{dept.absentDays}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-800 text-white font-bold">
              <tr>
                <td className="px-6 py-4 rounded-bl-xl">รวมทั้งบริษัท</td>
                <td className="px-6 py-4 text-center">{kpis.totalEmployees}</td>
                <td className="px-6 py-4 text-right">{formatMoney(kpis.totalBaseSalary)}</td>
                <td className="px-6 py-4 text-right text-emerald-400">+{formatMoney(kpis.totalOtCost)}</td>
                <td className="px-6 py-4 text-right text-amber-400">+{formatMoney(kpis.totalDiligence)}</td>
                <td className="px-6 py-4 text-right text-rose-400">-{formatMoney(kpis.totalDeductions)}</td>
                <td className="px-6 py-4 text-center text-amber-400">{formatMoney(kpis.totalLateMins)}</td>
                <td className="px-6 py-4 text-center text-rose-400">{kpis.totalAbsentDays}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}