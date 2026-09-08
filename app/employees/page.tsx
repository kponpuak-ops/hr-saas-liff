'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type BenefitItem = {
  name: string
  amount: number
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [showAddForm, setShowAddForm] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Master Data Options
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [benefitOptions, setBenefitOptions] = useState<any[]>([])

  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    role: 'Staff',
    phone: '',
    emergency_contact: '',
    address: '',
    avatar_url: '',
    base_salary: 0,
    department: '',
    position: '',
  })

  // Dynamic Benefits State
  const [employeeBenefits, setEmployeeBenefits] = useState<BenefitItem[]>([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setIsLoading(true)
    await Promise.all([fetchEmployees(), fetchMasterData()])
    setIsLoading(false)
  }

  const fetchEmployees = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    if (data) setEmployees(data)
  }

  const fetchMasterData = async () => {
    const { data: deptData } = await supabase.from('departments').select('*')
    const { data: posData } = await supabase.from('positions').select('*')
    const { data: benData } = await supabase.from('benefit_master').select('*')

    if (deptData) setDepartments(deptData)
    if (posData) setPositions(posData)
    if (benData) setBenefitOptions(benData)

    if (deptData && deptData.length > 0) setFormData(prev => ({ ...prev, department: deptData[0].name }))
    if (posData && posData.length > 0) setFormData(prev => ({ ...prev, position: posData[0].title }))
  }

  // เพิ่มรายการสวัสดิการ
  const handleAddBenefitRow = () => {
    const defaultName = benefitOptions.length > 0 ? benefitOptions[0].name : 'สวัสดิการอื่นๆ'
    setEmployeeBenefits(prev => [...prev, { name: defaultName, amount: 0 }])
  }

  // ลบรายการสวัสดิการ
  const handleRemoveBenefitRow = (index: number) => {
    setEmployeeBenefits(prev => prev.filter((_, i) => i !== index))
  }

  // อัปเดตรายการสวัสดิการ
  const handleBenefitChange = (index: number, field: 'name' | 'amount', value: any) => {
    setEmployeeBenefits(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: field === 'amount' ? Number(value) : String(value)
      }
      return updated
    })
  }

  // บันทึกพนักงานใหม่
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const { error } = await supabase.from('users').insert([
      {
        ...formData,
        benefits: employeeBenefits,
      },
    ])

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('บันทึกข้อมูลพนักงานเรียบร้อยแล้ว')
      setShowAddForm(false)
      fetchEmployees()
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูลระบบ...</div>
  }

  return (
    <div className="pb-12">
      {/* ส่วนหัว */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">จัดการรายชื่อพนักงาน</h1>
          <p className="text-slate-500 text-sm">ข้อมูลส่วนตัว ฐานเงินเดือน สวัสดิการ และโครงสร้างตำแหน่ง</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2 ${
            showAddForm ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {showAddForm ? '❌ ยกเลิก' : '➕ เพิ่มพนักงานใหม่'}
        </button>
      </div>

      {/* ฟอร์มเพิ่มพนักงานแบบรายละเอียด */}
      {showAddForm && (
        <form onSubmit={handleAddEmployee} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md mb-8 space-y-6">
          
          {/* หมวดที่ 1: ข้อมูลส่วนตัวและรูปถ่าย */}
          <div>
            <h2 className="text-base font-bold text-indigo-900 border-b pb-2 mb-4 flex items-center gap-2">
              👤 ข้อมูลส่วนตัวและรูปถ่าย
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อจริง *</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">นามสกุล *</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ลิงก์รูปถ่าย (URL Profile)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* หมวดที่ 2: ตำแหน่ง และแผนก */}
          <div>
            <h2 className="text-base font-bold text-indigo-900 border-b pb-2 mb-4 flex items-center gap-2">
              🏢 โครงสร้างองค์กร
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">แผนก</label>
                <select
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ตำแหน่งงาน</label>
                <select
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.title}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">สิทธิ์ในระบบ (System Role)</label>
                <select
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="Staff">พนักงานทั่วไป (Staff)</option>
                  <option value="Manager">ผู้จัดการ (Manager)</option>
                  <option value="HR">ฝ่ายบุคคล (HR Admin)</option>
                </select>
              </div>
            </div>
          </div>

          {/* หมวดที่ 3: เงินเดือน & สวัสดิการ */}
          <div>
            <h2 className="text-base font-bold text-indigo-900 border-b pb-2 mb-4 flex items-center gap-2">
              💰 ฐานเงินเดือน และสวัสดิการ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ฐานเงินเดือนประจำ (บาท)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* รายการสวัสดิการแบบเพิ่ม/ลบได้อิสระ */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-700">สวัสดิการและเงินบวกเพิ่มเติม</span>
                <button
                  type="button"
                  onClick={handleAddBenefitRow}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                >
                  ➕ เพิ่มรายการสวัสดิการ
                </button>
              </div>

              {employeeBenefits.map((item, index) => (
                <div key={index} className="flex gap-3 mb-2 items-center">
                  <select
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white w-1/2 outline-none"
                    value={item.name}
                    onChange={(e) => handleBenefitChange(index, 'name', e.target.value)}
                  >
                    {benefitOptions.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="จำนวนเงิน"
                    className="p-2 border border-slate-300 rounded-lg text-sm w-1/3 outline-none"
                    value={item.amount}
                    onChange={(e) => handleBenefitChange(index, 'amount', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveBenefitRow(index)}
                    className="text-rose-500 hover:text-rose-700 text-sm font-bold p-1"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              {employeeBenefits.length === 0 && (
                <p className="text-xs text-slate-400 italic">ยังไม่ได้เพิ่มสวัสดิการพิเศษ</p>
              )}
            </div>
          </div>

          {/* หมวดที่ 4: การติดต่อ */}
          <div>
            <h2 className="text-base font-bold text-indigo-900 border-b pb-2 mb-4 flex items-center gap-2">
              📞 ช่องทางการติดต่อ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">เบอร์โทรศัพท์ติดต่อ</label>
                <input
                  type="text"
                  placeholder="08X-XXX-XXXX"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">เบอร์ติดต่อฉุกเฉิน (พร้อมชื่อผู้ติดต่อ)</label>
                <input
                  type="text"
                  placeholder="08X-XXX-XXXX (คุณแม่)"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ที่อยู่ตามทะเบียนบ้าน/ที่อยู่ปัจจุบัน</label>
              <textarea
                rows={2}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          {/* ปุ่มบันทึก */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูลพนักงาน'}
            </button>
          </div>
        </form>
      )}

      {/* ตารางแสดงผลรายชื่อพนักงานฉบับสมบูรณ์ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3">พนักงาน</th>
                <th className="pb-3">แผนก / ตำแหน่ง</th>
                <th className="pb-3">เบอร์ติดต่อ</th>
                <th className="pb-3">ฐานเงินเดือน</th>
                <th className="pb-3">สวัสดิการ</th>
                <th className="pb-3">สถานะ LINE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors text-sm">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm overflow-hidden">
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          `${emp.first_name[0] || ''}`
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{emp.first_name} {emp.last_name}</div>
                        <div className="text-xs text-slate-400">สิทธิ์: {emp.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="font-semibold text-slate-700">{emp.position || '-'}</div>
                    <div className="text-xs text-slate-400">{emp.department || '-'}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-slate-700">{emp.phone || '-'}</div>
                    <div className="text-xs text-rose-500">ฉุกเฉิน: {emp.emergency_contact || '-'}</div>
                  </td>
                  <td className="py-4 font-semibold text-slate-800">
                    {emp.base_salary ? `฿${Number(emp.base_salary).toLocaleString()}` : '-'}
                  </td>
                  <td className="py-4">
                    {emp.benefits && emp.benefits.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {emp.benefits.map((b: any, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                            {b.name}: +฿{b.amount}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-4">
                    {emp.line_user_id ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        ✅ ผูกแล้ว
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                        รอผูก LINE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}