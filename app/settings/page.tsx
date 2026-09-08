'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function SettingsPage() {
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Input States
  const [newDept, setNewDept] = useState('')
  const [newPos, setNewPos] = useState('')
  const [newBenefit, setNewBenefit] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setIsLoading(true)
    const { data: deptData } = await supabase.from('departments').select('*').order('id', { ascending: true })
    const { data: posData } = await supabase.from('positions').select('*').order('id', { ascending: true })
    const { data: benData } = await supabase.from('benefit_master').select('*').order('id', { ascending: true })

    if (deptData) setDepartments(deptData)
    if (posData) setPositions(posData)
    if (benData) setBenefits(benData)
    setIsLoading(false)
  }

  // Add Master Item
  const handleAdd = async (table: string, fieldName: string, value: string, resetFn: () => void) => {
    if (!value.trim()) return
    const { error } = await supabase.from(table).insert([{ [fieldName]: value.trim() }])
    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else {
      resetFn()
      fetchSettings()
    }
  }

  // Delete Master Item
  const handleDelete = async (table: string, id: number) => {
    if (!confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) alert('ไม่สามารถลบได้เนื่องจากมีการใช้งานอยู่')
    else fetchSettings()
  }

  if (isLoading) return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูลการตั้งค่า...</div>

  return (
    <div className="pb-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">ตั้งค่าองค์กร (Organization Master Data)</h1>
      <p className="text-slate-500 text-sm mb-8">กำหนดแผนก ตำแหน่งงาน และสวัสดิการ สำหรับใช้เลือกในระบบ HR</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. จัดการแผนก */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">🏢 รายชื่อแผนก</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="ชื่อแผนกใหม่..."
              className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
            />
            <button
              onClick={() => handleAdd('departments', 'name', newDept, () => setNewDept(''))}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
            >
              เพิ่ม
            </button>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {departments.map((d) => (
              <li key={d.id} className="py-2.5 flex justify-between items-center text-slate-700">
                <span>{d.name}</span>
                <button onClick={() => handleDelete('departments', d.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">🗑️</button>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. จัดการตำแหน่ง */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">💼 ตำแหน่งงาน</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="ชื่อตำแหน่งใหม่..."
              className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={newPos}
              onChange={(e) => setNewPos(e.target.value)}
            />
            <button
              onClick={() => handleAdd('positions', 'title', newPos, () => setNewPos(''))}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
            >
              เพิ่ม
            </button>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {positions.map((p) => (
              <li key={p.id} className="py-2.5 flex justify-between items-center text-slate-700">
                <span>{p.title}</span>
                <button onClick={() => handleDelete('positions', p.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">🗑️</button>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. จัดการสวัสดิการ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">🎁 ประเภทสวัสดิการ</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="สวัสดิการใหม่..."
              className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={newBenefit}
              onChange={(e) => setNewBenefit(e.target.value)}
            />
            <button
              onClick={() => handleAdd('benefit_master', 'name', newBenefit, () => setNewBenefit(''))}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
            >
              เพิ่ม
            </button>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {benefits.map((b) => (
              <li key={b.id} className="py-2.5 flex justify-between items-center text-slate-700">
                <span>{b.name}</span>
                <button onClick={() => handleDelete('benefit_master', b.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">🗑️</button>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}