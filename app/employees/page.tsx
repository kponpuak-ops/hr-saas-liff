'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type BenefitItem = {
  name: string
  amount: number
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  // State เก็บข้อมูลโควต้าพนักงาน
  const [companyQuota, setCompanyQuota] = useState({ max: 0, current: 0 })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [showAddForm, setShowAddForm] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false)

  // State สำหรับแก้ไข และ Pop-up ขยายรูปภาพ
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // State สำหรับ Modal สรุปโปรไฟล์ & การลา
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [leaveSummary, setLeaveSummary] = useState<any[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false)

  // Filter & Search State
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Master Data Options
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [benefitOptions, setBenefitOptions] = useState<any[]>([])

  // Form State Initial Value (เพิ่ม email, payment_method, bank_account, allow_remote_attendance)
  const initialFormState = {
    employee_id: '',
    first_name: '',
    last_name: '',
    role: 'staff',
    email: '',
    phone: '',
    emergency_contact: '',
    address: '',
    avatar_url: '',
    employment_type: 'full_time',
    base_salary: 15000,
    daily_rate: 500,
    payment_method: 'transfer', // 'transfer' | 'cash'
    bank_account: '',
    department: '',
    position: '',
    start_date: new Date().toISOString().split('T')[0],
    allow_remote_attendance: false,
  }

  const [formData, setFormData] = useState(initialFormState)
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
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: currentUser } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_id', session.user.id)
      .single()

    if (!currentUser?.company_id) return

    // ดึงโควต้าของบริษัท (max_employees)
    const { data: companyData } = await supabase
      .from('companies')
      .select('max_employees')
      .eq('id', currentUser.company_id)
      .single()

    // ดึงรายชื่อพนักงาน
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', currentUser.company_id)
      .neq('role', 'super_admin')
      //.neq('role', 'admin')
      .order('created_at', { ascending: false })

    if (data) {
      setEmployees(data)
      // บันทึกข้อมูลโควต้า (จำนวนที่มีอยู่ vs จำนวนที่สมัครไว้)
      setCompanyQuota({ 
        max: companyData?.max_employees || 0, 
        current: data.length 
      })
    }
  }

  const fetchMasterData = async () => {
    const { data: deptData } = await supabase.from('departments').select('*').order('id', { ascending: true })
    const { data: posData } = await supabase.from('positions').select('*').order('id', { ascending: true })
    const { data: benData } = await supabase.from('benefit_master').select('*').order('id', { ascending: true })

    if (deptData) setDepartments(deptData)
    if (posData) setPositions(posData)
    if (benData) setBenefitOptions(benData)

    if (deptData && deptData.length > 0) setFormData(prev => ({ ...prev, department: deptData[0].name }))
    if (posData && posData.length > 0) setFormData(prev => ({ ...prev, position: posData[0].title }))
  }

  // --- จัดการดูโปรไฟล์ & สรุปการลา ---
  const handleViewProfile = async (emp: any) => {
    setSelectedProfile(emp)
    setShowProfileModal(true)
    setIsLoadingProfile(true)

    try {
      const [leavesRes, typesRes] = await Promise.all([
        supabase.from('leaves').select('*').eq('user_id', emp.id),
        supabase.from('leave_types').select('*')
      ])

      const leaves = leavesRes.data || []
      const types = typesRes.data || []

      const summaryMap: Record<string, any> = {}

      leaves.forEach((l: any) => {
        if (!summaryMap[l.leave_type]) {
          const typeInfo = types.find((t: any) => t.name === l.leave_type)
          summaryMap[l.leave_type] = {
            name: l.leave_type,
            max: typeInfo?.max_paid_days || 0,
            approved: 0,
            pending: 0,
            rejected: 0
          }
        }

        const start = new Date(l.start_date)
        const end = new Date(l.end_date)
        const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

        if (l.status === 'approved') summaryMap[l.leave_type].approved += days
        if (l.status === 'pending') summaryMap[l.leave_type].pending += days
        if (l.status === 'rejected') summaryMap[l.leave_type].rejected += days
      })

      setLeaveSummary(Object.values(summaryMap))
    } catch (error) {
      console.error('Error fetching leave summary:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  // อัปโหลดไฟล์รูปภาพพนักงาน
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, avatar_url: publicUrlData.publicUrl }))
    } catch (error: any) {
      alert('อัปโหลดรูปภาพไม่สำเร็จ: ' + error.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleAddBenefitRow = () => {
    const defaultName = benefitOptions.length > 0 ? benefitOptions[0].name : 'สวัสดิการอื่นๆ'
    setEmployeeBenefits(prev => [...prev, { name: defaultName, amount: 0 }])
  }

  const handleRemoveBenefitRow = (index: number) => {
    setEmployeeBenefits(prev => prev.filter((_, i) => i !== index))
  }

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

  // เปิดฟอร์มแก้ไข (เพิ่มข้อมูลใหม่)
  const handleEditClick = (emp: any) => {
    setEditingEmployeeId(emp.id)
    setFormData({
      employee_id: emp.employee_id || '',
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      role: emp.role || 'staff',
      email: emp.email || '',
      phone: emp.phone || '',
      emergency_contact: emp.emergency_contact || '',
      address: emp.address || '',
      avatar_url: emp.avatar_url || '',
      employment_type: emp.employment_type || 'full_time',
      base_salary: emp.base_salary || 0,
      daily_rate: emp.daily_rate || 0,
      payment_method: emp.payment_method || 'transfer',
      bank_account: emp.bank_account || '',
      department: emp.department || (departments[0]?.name || ''),
      position: emp.position || (positions[0]?.title || ''),
      start_date: emp.start_date || new Date().toISOString().split('T')[0],
      allow_remote_attendance: emp.allow_remote_attendance || false,
    })
    setEmployeeBenefits(emp.benefits || [])
    setShowAddForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ยกเลิกฟอร์ม
  const handleCancelForm = () => {
    setShowAddForm(false)
    setEditingEmployeeId(null)
    setFormData({
      ...initialFormState,
      department: departments[0]?.name || '',
      position: positions[0]?.title || '',
    })
    setEmployeeBenefits([])
  }

  // บันทึกข้อมูล
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = {
      ...formData,
      company_id: 1,
      base_salary: Number(formData.base_salary),
      daily_rate: Number(formData.daily_rate),
      benefits: employeeBenefits,
    }

    if (editingEmployeeId) {
      const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', editingEmployeeId)

      if (error) {
        alert('เกิดข้อผิดพลาดในการอัปเดต: ' + error.message)
      } else {
        alert('💾 อัปเดตข้อมูลพนักงานเรียบร้อยแล้ว')
        handleCancelForm()
        fetchEmployees()
      }
    } else {
      const { error } = await supabase.from('users').insert([payload])

      if (error) {
        alert('เกิดข้อผิดพลาด: ' + error.message)
      } else {
        alert('💾 บันทึกข้อมูลพนักงานเรียบร้อยแล้ว')
        handleCancelForm()
        fetchEmployees()
      }
    }
    setIsSubmitting(false)
  }

  // ลบพนักงาน
  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`คุณต้องการลบพนักงาน "${name}" ออกจากระบบใช่หรือไม่?`)) return

    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) {
      alert('ไม่สามารถลบข้อมูลได้: ' + error.message)
    } else {
      alert('ลบข้อมูลพนักงานเรียบร้อยแล้ว')
      fetchEmployees()
    }
  }

  // อัปเดตสิทธิ์ลงเวลานอกสถานที่โดยตรงจากตาราง
  const toggleRemoteAttendance = async (id: string, currentValue: boolean) => {
    const { error } = await supabase.from('users').update({ allow_remote_attendance: !currentValue }).eq('id', id)
    if (!error) fetchEmployees()
  }

  // Filter Logic
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
    const matchesSearch = fullName.includes(search.toLowerCase()) || (emp.employee_id || '').toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || emp.employment_type === filterType
    return matchesSearch && matchesType
  })

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูลระบบ...</div>
  }

  return (
    <div className="pb-12 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">👥 จัดการรายชื่อพนักงาน</h1>
          <p className="text-slate-500 text-sm mt-1">
            ข้อมูลส่วนตัว ประเภทการจ้างงาน • โควต้าใช้งาน: <span className={companyQuota.current >= companyQuota.max ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{companyQuota.current} / {companyQuota.max}</span> คน
          </p>
        </div>
        <button
          onClick={() => {
            if (showAddForm) {
              handleCancelForm()
            } else {
              // 💡 เช็คโควต้าก่อนเปิดฟอร์มเพิ่มพนักงานใหม่
              if (companyQuota.current >= companyQuota.max) {
                alert(`⚠️ ไม่สามารถเพิ่มพนักงานได้\nโควต้าของคุณเต็มแล้ว (${companyQuota.current}/${companyQuota.max} คน)\n\nโปรดติดต่อผู้ให้บริการ (Super Admin) เพื่ออัปเกรดแพ็กเกจ`)
                return
              }
              setShowAddForm(true)
            }
          }}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${
            showAddForm ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {showAddForm ? '❌ ยกเลิก' : '➕ เพิ่มพนักงานใหม่'}
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="🔍 ค้นหาด้วย ชื่อ-นามสกุล หรือ รหัสพนักงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">ประเภทการจ้างงาน:</span>
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'full_time', label: 'ประจำ' },
            { id: 'probation', label: 'ทดลองงาน' },
            { id: 'daily', label: 'รายวัน' },
            { id: 'contract', label: 'สัญญาจ้าง' },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterType === type.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSaveEmployee} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-6 animate-fade-in">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              {editingEmployeeId ? '✏️ แก้ไขข้อมูลพนักงาน' : '➕ เพิ่มพนักงานใหม่'}
            </h2>
            <span className="text-xs text-slate-400">ID: {editingEmployeeId || 'ใหม่'}</span>
          </div>

          {/* หมวดที่ 1 */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">👤 ข้อมูลส่วนตัวและรูปถ่าย</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสพนักงาน</label>
                <input
                  type="text"
                  placeholder="เช่น EMP001"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                />
              </div>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">รูปถ่ายพนักงาน</label>
                <div className="flex items-center gap-3">
                  {formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Profile" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
                      ไม่มีรูป
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingPhoto}
                    className="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
                {uploadingPhoto && <span className="text-xs text-amber-600 mt-1 block">กำลังอัปโหลดรูปภาพ...</span>}
              </div>
            </div>
          </div>

          {/* หมวดที่ 2 */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">🏢 โครงสร้างองค์กร & ประเภทการจ้างงาน</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <option value="staff">พนักงานทั่วไป (Staff)</option>
                  <option value="manager">หัวหน้าแผนก (Manager)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่เริ่มงาน</label>
                <input
                  type="date"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* หมวดที่ 3 */}
          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-4">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">💳 ประเภทการจ้างงาน และ ค่าตอบแทนหลัก</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">ประเภทการจ้างงาน *</label>
                <select
                  className="w-full p-2.5 border border-indigo-200 rounded-xl text-sm font-bold bg-white text-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                >
                  <option value="full_time">👔 พนักงานประจำ (คิดเงินเดือนรายเดือน)</option>
                  <option value="probation">⏳ พนักงานทดลองงาน (คิดเงินเดือนรายเดือน)</option>
                  <option value="daily">📅 พนักงานรายวัน (คิดเงินตามจำนวนวันที่ทำจริง)</option>
                  <option value="contract">📝 พนักงานสัญญาจ้าง (คิดตามอัตราเหมาจ่าย)</option>
                </select>
              </div>

              {formData.employment_type === 'daily' ? (
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">ค่าจ้างรายวัน (บาท / วัน) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full p-2.5 border border-emerald-300 rounded-xl text-sm font-extrabold text-emerald-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.daily_rate}
                    onChange={(e) => setFormData({ ...formData, daily_rate: Number(e.target.value) })}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1">ฐานเงินเดือนประจำ (บาท / เดือน) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full p-2.5 border border-indigo-300 rounded-xl text-sm font-extrabold text-indigo-700 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.base_salary}
                    onChange={(e) => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* หมวดที่ 4: ช่องทางการรับเงิน */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">🏦 ข้อมูลบัญชีรับเงิน</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ช่องทางการรับเงิน</label>
                <select
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                >
                  <option value="transfer">🏦 โอนเข้าบัญชีธนาคาร</option>
                  <option value="cash">💵 รับเป็นเงินสด</option>
                </select>
              </div>
              {formData.payment_method === 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ข้อมูลบัญชีธนาคาร (ชื่อธนาคาร / เลขบัญชี)</label>
                  <input
                    type="text"
                    placeholder="เช่น กสิกรไทย 012-3-45678-9"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* หมวดที่ 5: สวัสดิการเพิ่มเติม */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">🎁 สวัสดิการและเงินบวกประจำเดือน</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-700">รายการสวัสดิการประจำตัวพนักงาน</span>
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

          {/* หมวดที่ 6: ช่องทางการติดต่อ */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">📞 ช่องทางการติดต่อ</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">อีเมล (Email)</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">เบอร์ติดต่อฉุกเฉิน (ชื่อผู้ติดต่อ)</label>
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition-all text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingPhoto}
              className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังบันทึก...' : editingEmployeeId ? '💾 บันทึกการแก้ไข' : '💾 บันทึกพนักงานใหม่'}
            </button>
          </div>
        </form>
      )}

      {/* ตารางแสดงพนักงาน */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto p-6">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 min-w-[200px]">พนักงาน</th>
                <th className="pb-3 min-w-[150px]">แผนก / ตำแหน่ง</th>
                <th className="pb-3 text-center">ประเภทการจ้างงาน</th>
                <th className="pb-3 text-center">สิทธิ์การใช้งาน (Role)</th>
                <th className="pb-3 text-center">ลงเวลานอกสถานที่</th>
                <th className="pb-3 text-center w-28">สถานะ LINE</th>
                <th className="pb-3 text-center w-56">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">ไม่พบข้อมูลพนักงานที่ค้นหา</td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          title="คลิกเพื่อดูรูปขนาดใหญ่"
                          onClick={() => emp.avatar_url && setPreviewImage(emp.avatar_url)}
                          className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer relative group"
                        >
                          {emp.avatar_url ? (
                            <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            `${emp.first_name?.[0] || ''}`
                          )}
                          {emp.avatar_url && (
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] transition-opacity">
                              🔍
                            </div>
                          )}
                        </button>
                        <div>
                          <div className="font-bold text-slate-800">{emp.first_name} {emp.last_name}</div>
                          <div className="text-xs text-slate-400">ID: {emp.employee_id || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="font-semibold text-slate-700">{emp.position || '-'}</div>
                      <div className="text-xs text-slate-400">{emp.department || '-'}</div>
                    </td>
                    <td className="py-4 text-center">
                      {emp.employment_type === 'full_time' && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-bold">👔 ประจำ</span>}
                      {emp.employment_type === 'probation' && <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-bold">⏳ ทดลองงาน</span>}
                      {emp.employment_type === 'daily' && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-bold">📅 รายวัน</span>}
                      {emp.employment_type === 'contract' && <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-xs font-bold">📝 สัญญาจ้าง</span>}
                    </td>
                    <td className="py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        emp.role === 'admin' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                        emp.role === 'manager' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                        'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        {emp.role === 'admin' ? 'Admin' : emp.role === 'manager' ? 'Manager' : 'Staff'}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <button 
                        onClick={() => toggleRemoteAttendance(emp.id, emp.allow_remote_attendance)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                          emp.allow_remote_attendance ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        title="คลิกเพื่อสลับสิทธิ์การลงเวลานอกพื้นที่"
                      >
                        {emp.allow_remote_attendance ? '✅ อนุญาต' : '❌ ไม่อนุญาต'}
                      </button>
                    </td>
                    <td className="py-4 text-center">
                      {emp.line_user_id ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">✅ ผูกแล้ว</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">รอผูก LINE</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => handleViewProfile(emp)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors"
                          title="ดูโปรไฟล์และสิทธิ์การลา"
                        >
                          🔍 โปรไฟล์
                        </button>
                        <button
                          onClick={() => handleEditClick(emp)}
                          className="px-2.5 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors"
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id, `${emp.first_name} ${emp.last_name}`)}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors"
                        >
                          🗑️ ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ดูโปรไฟล์ & สรุปสิทธิ์การลา */}
      {showProfileModal && selectedProfile && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowProfileModal(false)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">โปรไฟล์ & สิทธิ์การลา</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕ ปิด
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* ข้อมูลพนักงานเบื้องต้น */}
              <div className="flex items-center gap-4 border border-slate-200 p-4 rounded-xl shadow-sm">
                <button
                  type="button"
                  title={selectedProfile.avatar_url ? "คลิกเพื่อดูรูปขนาดใหญ่" : ""}
                  onClick={() => selectedProfile.avatar_url && setPreviewImage(selectedProfile.avatar_url)}
                  className={`w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-2xl overflow-hidden border border-slate-200 shrink-0 relative group ${
                    selectedProfile.avatar_url ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all' : 'cursor-default'
                  }`}
                >
                  {selectedProfile.avatar_url ? (
                    <>
                      <img src={selectedProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-sm transition-opacity">
                        🔍
                      </div>
                    </>
                  ) : (
                    selectedProfile.first_name?.[0]
                  )}
                </button>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedProfile.first_name} {selectedProfile.last_name}</h3>
                  <div className="text-sm font-medium text-slate-500 mt-0.5">
                    {selectedProfile.position || '-'} • {selectedProfile.department || '-'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-col gap-1">
                    <div className="flex gap-4">
                      <span><span className="font-bold">ID:</span> {selectedProfile.employee_id || '-'}</span>
                      <span><span className="font-bold">📞</span> {selectedProfile.phone || '-'}</span>
                    </div>
                    <div className="flex gap-4">
                      <span><span className="font-bold">✉️</span> {selectedProfile.email || '-'}</span>
                      <span>
                        <span className="font-bold">🏦</span> {selectedProfile.payment_method === 'cash' ? 'รับเงินสด' : `โอนเข้าบัญชี (${selectedProfile.bank_account || 'ไม่ได้ระบุ'})`}
                      </span>
                    </div>
                    {/* ข้อมูลเงินเดือนและสวัสดิการ */}
                    <div className="flex gap-4 pt-1 mt-1 border-t border-slate-100">
                      <span>
                        <span className="font-bold">💰 {selectedProfile.employment_type === 'daily' ? 'รายวัน:' : 'เงินเดือน:'}</span>{' '}
                        <span className="text-emerald-600 font-bold">฿{Number(selectedProfile.employment_type === 'daily' ? (selectedProfile.daily_rate || 0) : (selectedProfile.base_salary || 0)).toLocaleString()}</span>
                      </span>
                      <span>
                        <span className="font-bold">🎁 สวัสดิการ:</span>{' '}
                        {selectedProfile.benefits && selectedProfile.benefits.length > 0 ? (
                          <span className="text-indigo-600 font-semibold">{selectedProfile.benefits.map((b: any) => `${b.name} (+฿${b.amount})`).join(', ')}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* สรุปสิทธิ์การลา */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">📊 ประวัติการลาประจำปี (เฉพาะที่เคยใช้งาน)</h3>
                
                {isLoadingProfile ? (
                  <div className="py-6 text-center text-sm font-medium text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                    กำลังคำนวณข้อมูล...
                  </div>
                ) : leaveSummary.length === 0 ? (
                  <div className="py-8 text-center text-sm font-medium text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                    ยังไม่มีประวัติการยื่นใบลา
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaveSummary.map((summary, idx) => {
                      const isExceeding = summary.max !== 999 && summary.approved > summary.max;
                      return (
                        <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-slate-700">{summary.name}</span>
                            <span className="text-xs font-bold text-slate-500">
                              สิทธิ์รายปี: {summary.max === 999 ? 'ตามจริง (ไม่จำกัด)' : `${summary.max} วัน`}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className={`px-2 py-1 rounded-md font-bold ${isExceeding ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              ✅ อนุมัติแล้ว: {summary.approved} วัน {isExceeding ? '(เกินสิทธิ์)' : ''}
                            </span>
                            {summary.pending > 0 && (
                              <span className="px-2 py-1 rounded-md font-bold bg-amber-100 text-amber-700">
                                ⏳ รอตรวจสอบ: {summary.pending} วัน
                              </span>
                            )}
                            {summary.rejected > 0 && (
                              <span className="px-2 py-1 rounded-md font-bold bg-rose-100 text-rose-700">
                                ❌ ไม่อนุมัติ: {summary.rejected} วัน
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up แสดงรูปภาพขนาดใหญ่ */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/80 text-white rounded-full flex items-center justify-center font-bold text-sm hover:bg-slate-900 transition-colors shadow-md z-10"
            >
              ✕
            </button>
            <div className="flex justify-center items-center bg-slate-100 rounded-xl overflow-hidden min-h-[300px]">
              <img src={previewImage} alt="รูปพนักงานแบบขยาย" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}