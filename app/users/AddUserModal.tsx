'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AddUserModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('employee')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // ฟังก์ชันสุ่มรหัส 6 หลักสำหรับผูก LINE
  const generateBindingCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await supabase.from('users').insert([
      {
        company_id: 1, // (ใส่เลข 1 ชั่วคราว จนกว่าเราจะทำระบบ Login เสร็จ)
        first_name: firstName,
        last_name: lastName,
        role: role,
        binding_code: generateBindingCode(),
      }
    ])

    setIsLoading(false)

    if (!error) {
      setIsOpen(false)
      setFirstName('')
      setLastName('')
      router.refresh() // สั่งให้หน้าเว็บดึงข้อมูลใหม่ทันที
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors"
      >
        + เพิ่มพนักงานใหม่
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-slate-800">เพิ่มพนักงานใหม่</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อจริง</label>
                  <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล</label>
                  <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">บทบาท</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="employee">พนักงาน (Employee)</option>
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">ยกเลิก</button>
                <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
                  {isLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}