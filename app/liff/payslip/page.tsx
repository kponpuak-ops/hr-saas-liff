'use client'

import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'

export default function EmployeePayslipLiff() {
  const [employee, setEmployee] = useState<any>(null)
  const [payslips, setPayslips] = useState<any[]>([])
  const [selectedSlip, setSelectedSlip] = useState<any>(null)
  const [slipDetails, setSlipDetails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initLiff = async () => {
      try {
        // TODO: ใส่ LIFF ID ที่ได้จาก LINE Developers Console
        await liff.init({ liffId: 'YOUR_LIFF_ID_HERE' }) 
        
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        
        const profile = await liff.getProfile()
        fetchEmployeeData(profile.userId)
      } catch (err) {
        console.error('LIFF Init Error:', err)
        setError('ไม่สามารถเชื่อมต่อระบบ LINE ได้')
        setLoading(false)
      }
    }

    initLiff()
  }, [])

  const fetchEmployeeData = async (lineUserId: string) => {
    try {
      // 1. ตรวจสอบว่า LINE UID นี้ผูกกับพนักงานคนไหน
      const { data: empData, error: empError } = await supabase
        .from('users')
        .select('*')
        .eq('line_user_id', lineUserId)
        .single()

      if (empError || !empData) {
        setError('❌ ไม่พบข้อมูลพนักงาน กรุณาติดต่อ HR เพื่อผูกบัญชี LINE ของคุณ')
        setLoading(false)
        return
      }
      setEmployee(empData)

      // 2. ดึงเฉพาะสลิปที่ HR กด "อนุมัติแล้ว" เท่านั้น
      const { data: slips } = await supabase
        .from('payslips')
        .select('*, payroll_cycles(name, payment_date)')
        .eq('user_id', empData.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      setPayslips(slips || [])
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const handleViewSlip = async (slip: any) => {
    setSelectedSlip(slip)
    const { data } = await supabase
      .from('payslip_details')
      .select('*')
      .eq('payslip_id', slip.id)
      .order('id', { ascending: true })
      
    setSlipDetails(data || [])
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 2 }).format(amount || 0)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-bold">กำลังโหลดข้อมูล...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 bg-slate-50 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">{error}</h2>
        <button onClick={() => liff.closeWindow()} className="mt-6 px-6 py-2 bg-slate-800 text-white font-bold rounded-full">ปิดหน้าต่าง</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header พนักงาน */}
      <div className="bg-indigo-600 text-white p-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold border-2 border-white/50 overflow-hidden">
            {employee?.avatar_url ? <img src={employee.avatar_url} className="w-full h-full object-cover" /> : '👤'}
          </div>
          <div>
            <h1 className="text-xl font-bold">{employee?.first_name} {employee?.last_name}</h1>
            <p className="text-indigo-200 text-sm">{employee?.position || 'พนักงาน'} • ID: {employee?.employee_id}</p>
          </div>
        </div>
      </div>

      <div className="p-4 mt-2">
        {!selectedSlip ? (
          <>
            <h2 className="text-sm font-bold text-slate-500 mb-4 px-2">🧾 ประวัติสลิปเงินเดือนของคุณ</h2>
            {payslips.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-500">
                ยังไม่มีสลิปเงินเดือนในระบบ
              </div>
            ) : (
              <div className="space-y-3">
                {payslips.map(slip => (
                  <div key={slip.id} onClick={() => handleViewSlip(slip)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform cursor-pointer flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800">{slip.payroll_cycles?.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">รับเงิน: {formatDate(slip.payroll_cycles?.payment_date)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-indigo-600">฿{formatMoney(slip.net_pay)}</div>
                      <div className="text-[10px] text-slate-400 mt-1">ดูรายละเอียด ➔</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="animate-fade-in">
            <button onClick={() => setSelectedSlip(null)} className="mb-4 text-sm font-bold text-indigo-600 flex items-center gap-1">
              ← กลับไปหน้ารวม
            </button>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 text-center bg-slate-50">
                <h3 className="text-lg font-black text-slate-800">ใบแจ้งเงินเดือน</h3>
                <p className="text-sm text-slate-500 font-medium">{selectedSlip.payroll_cycles?.name}</p>
              </div>

              <div className="p-5 space-y-5">
                {/* รายรับ */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">รายได้ (Earnings)</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">เงินเดือนพื้นฐาน</span>
                      <span className="font-medium text-slate-800">{formatMoney(selectedSlip.base_salary)}</span>
                    </div>
                    {slipDetails.filter(d => d.type === 'earning').map(item => (
                      <div key={item.id} className="flex justify-between">
                        <span className="text-slate-600">{item.item_name}</span>
                        <span className="font-medium text-emerald-600">+{formatMoney(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100"></div>

                {/* รายจ่าย */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">รายการหัก (Deductions)</h4>
                  <div className="space-y-2 text-sm">
                    {slipDetails.filter(d => d.type === 'deduction').length === 0 ? (
                      <div className="text-slate-400 italic text-xs">ไม่มีรายการหัก</div>
                    ) : (
                      slipDetails.filter(d => d.type === 'deduction').map(item => (
                        <div key={item.id} className="flex justify-between">
                          <span className="text-slate-600">{item.item_name}</span>
                          <span className="font-medium text-rose-500">-{formatMoney(item.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200 border-dashed pt-4">
                  <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl">
                    <span className="font-bold text-indigo-900">รับสุทธิ (Net Pay)</span>
                    <span className="text-xl font-black text-indigo-700">฿{formatMoney(selectedSlip.net_pay)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}