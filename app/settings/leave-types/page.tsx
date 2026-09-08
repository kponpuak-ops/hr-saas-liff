'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export default function LeaveTypesSettingsPage() {
  const [leaveTypes, setLeaveTypes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLeaveTypes()
  }, [])

  const fetchLeaveTypes = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.error('Error fetching leave types:', error)
    } else {
      setLeaveTypes(data || [])
    }
    setIsLoading(false)
  }

  // ฟังก์ชันสลับสถานะ (เปิด/ปิด เงื่อนไข)
  const toggleSetting = async (id: number, field: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('leave_types')
      .update({ [field]: !currentValue })
      .eq('id', id)

    if (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูล')
    } else {
      fetchLeaveTypes()
    }
  }

  // ฟังก์ชันอัปเดตจำนวนวันลา
  const handleUpdateDays = async (id: number, newValue: number) => {
    const { error } = await supabase
      .from('leave_types')
      .update({ max_paid_days: newValue })
      .eq('id', id)

    if (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตจำนวนวัน')
    } else {
      fetchLeaveTypes()
    }
  }

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="pb-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/settings" className="text-slate-400 hover:text-indigo-600 font-bold text-sm bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
          ← กลับ
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">จัดการประเภทการลา (Leave Types)</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="pb-3 font-medium">ประเภทการลา</th>
                <th className="pb-3 font-medium text-center">สิทธิ์รับค่าจ้าง (วัน/ปี)</th>
                <th className="pb-3 font-medium text-center">รายเดือนได้เงิน?</th>
                <th className="pb-3 font-medium text-center">รายวันได้เงิน?</th>
                <th className="pb-3 font-medium text-center">ทดลองงานลาได้?</th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-4 font-bold text-slate-800">
                    {item.name}
                  </td>
                  <td className="py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        defaultValue={item.max_paid_days}
                        onBlur={(e) => handleUpdateDays(item.id, Number(e.target.value))}
                        className="w-20 text-center p-1.5 border border-slate-300 rounded-lg text-sm font-bold text-indigo-600 bg-indigo-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-xs text-slate-400 font-medium">(ใส่ 999 = ไม่จำกัด)</span>
                    </div>
                  </td>
                  <td className="py-4 text-center">
                    <button 
                      onClick={() => toggleSetting(item.id, 'is_paid_for_monthly', item.is_paid_for_monthly)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        item.is_paid_for_monthly ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {item.is_paid_for_monthly ? '✅ ได้เงิน' : '❌ ไม่ได้เงิน'}
                    </button>
                  </td>
                  <td className="py-4 text-center">
                    <button 
                      onClick={() => toggleSetting(item.id, 'is_paid_for_daily', item.is_paid_for_daily)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        item.is_paid_for_daily ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {item.is_paid_for_daily ? '✅ ได้เงิน' : '❌ ไม่ได้เงิน'}
                    </button>
                  </td>
                  <td className="py-4 text-center">
                    <button 
                      onClick={() => toggleSetting(item.id, 'allow_probation', item.allow_probation)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        item.allow_probation ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      }`}
                    >
                      {item.allow_probation ? '✅ ลาได้' : '❌ ลาไม่ได้'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-4">* ตัวเลขสิทธิ์รับค่าจ้างจะบันทึกอัตโนมัติเมื่อพิมพ์เสร็จและคลิกพื้นที่อื่น</p>
        <p className="text-xs text-slate-400 mt-1">* กดที่ปุ่มสถานะเพื่อสลับการตั้งค่าเงื่อนไขการลาทันที</p>
      </div>
    </div>
  )
}