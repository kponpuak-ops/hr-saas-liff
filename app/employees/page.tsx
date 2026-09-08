'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // State สำหรับเปิด/ปิดฟอร์ม และเก็บข้อมูลพนักงานใหม่
  const [showAddForm, setShowAddForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    role: 'Staff'
  })

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

  // ฟังก์ชันบันทึกข้อมูลพนักงานใหม่ลงฐานข้อมูล
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const { error } = await supabase
      .from('users')
      .insert([
        {
          first_name: newEmployee.first_name,
          last_name: newEmployee.last_name,
          role: newEmployee.role,
        }
      ])

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('เพิ่มพนักงานเรียบร้อยแล้ว')
      setNewEmployee({ first_name: '', last_name: '', role: 'Staff' }) // เคลียร์ฟอร์ม
      setShowAddForm(false) // ปิดฟอร์ม
      fetchEmployees() // โหลดข้อมูลใหม่
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดรายชื่อพนักงาน...</div>
  }

  return (
    <div>
      {/* ส่วนหัวและปุ่มเพิ่มพนักงาน */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">รายชื่อพนักงาน (Employees)</h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 ${showAddForm ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          {showAddForm ? '❌ ปิดหน้าต่าง' : '➕ เพิ่มพนักงานใหม่'}
        </button>
      </div>

      {/* ฟอร์มเพิ่มพนักงาน (จะแสดงก็ต่อเมื่อกดปุ่ม) */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-fade-in">
          <h2 className="text-lg font-bold text-slate-800 mb-4">ข้อมูลพนักงานใหม่</h2>
          <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อจริง</label>
              <input 
                type="text" 
                required
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newEmployee.first_name}
                onChange={(e) => setNewEmployee({...newEmployee, first_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล</label>
              <input 
                type="text" 
                required
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newEmployee.last_name}
                onChange={(e) => setNewEmployee({...newEmployee, last_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ตำแหน่ง</label>
              <select 
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
              >
                <option value="Staff">พนักงานทั่วไป (Staff)</option>
                <option value="Manager">ผู้จัดการ (Manager)</option>
                <option value="HR">ฝ่ายบุคคล (HR)</option>
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end mt-2">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* ตารางแสดงรายชื่อพนักงาน */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                <th className="pb-3 font-medium">ตำแหน่ง</th>
                <th className="pb-3 font-medium">สถานะ LINE</th>
                <th className="pb-3 font-medium">วันที่เพิ่มเข้าระบบ</th>
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
                        ✅ ผูกบัญชีแล้ว
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
                    ยังไม่มีพนักงานในระบบ กรุณากดปุ่มเพิ่มพนักงานใหม่
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