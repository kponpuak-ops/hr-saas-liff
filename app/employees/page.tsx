'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setEmployees(data)
    }
    setIsLoading(false)
  }

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดรายชื่อพนักงาน...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">รายชื่อพนักงาน (Employees)</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                <th className="pb-3 font-medium">ตำแหน่ง (Role)</th>
                <th className="pb-3 font-medium">LINE ผูกบัญชี</th>
                <th className="pb-3 font-medium">วันที่เข้าร่วม</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-4 font-medium text-slate-800">
                    {emp.first_name} {emp.last_name}
                  </td>
                  <td className="py-4 text-sm text-slate-600">{emp.role || '-'}</td>
                  <td className="py-4">
                    {emp.line_user_id ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        ✅ ผูกแล้ว
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                        รอผูกบัญชี
                      </span>
                    )}
                  </td>
                  <td className="py-4 text-sm text-slate-500">
                    {new Date(emp.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    ยังไม่มีพนักงานในระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}