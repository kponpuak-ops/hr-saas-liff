'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SuperAdminDashboard() {
    const router = useRouter()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }
    const [companies, setCompanies] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // States สำหรับ Modals จัดการบริษัท
    const [isFormModalOpen, setIsFormModalOpen] = useState(false)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [viewCompany, setViewCompany] = useState<any | null>(null)

    // States สำหรับโหมดแก้ไข
    const [isEditMode, setIsEditMode] = useState(false)
    const [editCompanyId, setEditCompanyId] = useState<number | null>(null)

    // States สำหรับสร้างแอดมินบริษัท
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false)
    const [targetCompany, setTargetCompany] = useState<any | null>(null)
    const [adminData, setAdminData] = useState({ name: '', email: '', password: '' })
    const [isAdminSubmitting, setIsAdminSubmitting] = useState(false)

    // 💡 เปลี่ยนจาก package_type เป็น package_tier
    const [formData, setFormData] = useState({
        company_code: '', name: '', package_tier: 'trial', max_employees: 10,
        expire_date: '', contact_email: '', contact_phone: '', address: '', tax_id: '',
        is_active: true
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchCompanies()
    }, [])

   const fetchCompanies = async () => {
        // 1. ดึงข้อมูลบริษัททั้งหมด
        const { data: companiesData, error } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false })

        if (error || !companiesData) {
            setIsLoading(false)
            return
        }

        // 2. ดึงรายชื่อพนักงานทั้งหมด (กรอง Super Admin และ Admin บริษัทออก)
        const { data: usersData } = await supabase
            .from('users')
            .select('company_id')
            .neq('role', 'super_admin')
            .neq('role', 'admin') // 💡 เพิ่มบรรทัดนี้เพื่อไม่นับรวมแอดมินลูกค้า

        // สร้าง Object เพื่อนับพนักงานแยกตาม company_id
        const userCounts: Record<number, number> = {}
        if (usersData) {
            usersData.forEach(user => {
                if (user.company_id) {
                    userCounts[user.company_id] = (userCounts[user.company_id] || 0) + 1
                }
            })
        }

        // 3. นำจำนวนพนักงานไปรวมกับข้อมูลบริษัท
        const mergedCompanies = companiesData.map(company => ({
            ...company,
            current_employees: userCounts[company.id] || 0
        }))

        setCompanies(mergedCompanies)
        setIsLoading(false)
    }

    const resetForm = () => {
        setFormData({
            company_code: '', name: '', package_tier: 'trial', max_employees: 10,
            expire_date: '', contact_email: '', contact_phone: '', address: '', tax_id: '',
            is_active: true
        })
        setIsEditMode(false)
        setEditCompanyId(null)
    }

    const handleOpenAddModal = () => {
        resetForm()
        setIsFormModalOpen(true)
    }

    const handleOpenEditModal = (company: any) => {
        setFormData({
            company_code: company.company_code || '',
            name: company.name || '',
            package_tier: company.package_tier || 'trial', // 💡 ใช้ package_tier
            max_employees: company.max_employees || 10,
            expire_date: company.expire_date || '',
            contact_email: company.contact_email || '',
            contact_phone: company.contact_phone || '',
            address: company.address || '',
            tax_id: company.tax_id || '',
            is_active: company.is_active !== false
        })
        setIsEditMode(true)
        setEditCompanyId(company.id)
        setIsFormModalOpen(true)
    }

    const handleSaveCompany = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        const payload = {
            company_code: formData.company_code,
            name: formData.name,
            package_tier: formData.package_tier, // 💡 ส่งค่า package_tier ไปบันทึก
            max_employees: Number(formData.max_employees),
            expire_date: formData.expire_date || null,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone,
            address: formData.address,
            tax_id: formData.tax_id,
            is_active: formData.is_active
        }

        if (isEditMode && editCompanyId) {
            const { data, error } = await supabase
                .from('companies')
                .update(payload)
                .eq('id', editCompanyId)
                .select()

            if (!error && data) {
                setCompanies(companies.map(c => c.id === editCompanyId ? data[0] : c))
                setIsFormModalOpen(false)
                resetForm()
            } else {
                alert('เกิดข้อผิดพลาดในการแก้ไข: ' + (error?.message || ''))
            }
        } else {
            const { data, error } = await supabase
                .from('companies')
                .insert([payload])
                .select()

            if (!error && data) {
                setCompanies([data[0], ...companies])
                setIsFormModalOpen(false)
                resetForm()
            } else {
                alert('เกิดข้อผิดพลาดในการเพิ่ม: ' + (error?.message || ''))
            }
        }

        setIsSubmitting(false)
    }

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsAdminSubmitting(true)
        try {
            const res = await fetch('/api/create-company-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...adminData, company_id: targetCompany.id })
            })
            const result = await res.json()

            if (res.ok) {
                alert('สร้างบัญชีแอดมินให้บริษัทสำเร็จ! ส่งอีเมลและรหัสผ่านให้ลูกค้าได้เลยครับ')
                setIsAdminModalOpen(false)
                setAdminData({ name: '', email: '', password: '' })
            } else {
                alert('เกิดข้อผิดพลาด: ' + result.error)
            }
        } catch (error) {
            alert('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้')
        }
        setIsAdminSubmitting(false)
    }

    const getPackageBadge = (pkg: string) => {
        // 💡 ลบเครื่องหมายคำพูด (") ออกก่อนตรวจสอบ เผื่อในฐานข้อมูลติดมา
        const cleanPkg = pkg?.replace(/"/g, '')?.toLowerCase() || 'trial'
        switch (cleanPkg) {
            case 'pro': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-bold">Pro</span>
            case 'basic': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">Basic</span>
            case 'free': return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold">Free</span>
            default: return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold">Trial</span>
        }
    }

    if (isLoading) return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">🏢 ระบบจัดการบริษัทลูกค้า (Super Admin)</h1>
                        <p className="text-sm text-slate-500 mt-1">จัดการแพ็กเกจ โควต้า และวันหมดอายุของลูกค้าแต่ละบริษัท</p>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
                    >
                        + เพิ่มบริษัทใหม่
                    </button>
                    <button
                        onClick={handleLogout}
                        className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-rose-100 hover:text-rose-700 transition"
                    >
                        🚪 ออกจากระบบ
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-sm text-slate-500">
                                <th className="p-4 font-bold">รหัส</th>
                                <th className="p-4 font-bold">ชื่อบริษัท / ติดต่อ</th>
                                <th className="p-4 font-bold text-center">แพ็กเกจ</th>
                                <th className="p-4 font-bold text-center">พนักงาน (โควต้า)</th>
                                <th className="p-4 font-bold text-center">วันหมดอายุ</th>
                                <th className="p-4 font-bold text-center">สถานะ</th>
                                <th className="p-4 font-bold text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">ยังไม่มีบริษัทในระบบ</td>
                                </tr>
                            ) : (
                                companies.map((company) => (
                                    <tr key={company.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                                        <td className="p-4 font-bold text-indigo-600">{company.company_code || '-'}</td>
                                        <td className="p-4 font-bold text-slate-800">
                                            {company.name}
                                            {(company.contact_email || company.contact_phone) && (
                                                <div className="text-xs font-normal text-slate-400 mt-0.5">
                                                    {company.contact_phone} • {company.contact_email}
                                                </div>
                                            )}
                                        </td>
                                        {/* 💡 ดึงค่าจาก package_tier มาแสดงผล */}
                                        <td className="p-4 text-center">{getPackageBadge(company.package_tier)}</td>
                                        <td className="p-4 text-center font-medium text-slate-600">
                                            <span className={company.current_employees >= company.max_employees ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                                                {company.current_employees}
                                            </span>
                                            <span className="text-slate-400 mx-1">/</span>
                                            {company.max_employees || 0} คน
                                        </td>
                                        <td className="p-4 text-center text-sm font-medium text-slate-600">
                                            {company.expire_date ? new Date(company.expire_date).toLocaleDateString('th-TH') : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {company.is_active
                                                ? <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">🟢 ใช้งานปกติ</span>
                                                : <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md text-xs font-bold">🔴 ถูกระงับ</span>
                                            }
                                        </td>
                                        <td className="p-4 text-center space-x-3">
                                            <button
                                                onClick={() => { setTargetCompany(company); setIsAdminModalOpen(true); }}
                                                className="text-amber-600 font-bold text-xs hover:text-amber-700 transition"
                                            >
                                                🔑 สร้างแอดมิน
                                            </button>
                                            <button
                                                onClick={() => { setViewCompany(company); setIsViewModalOpen(true); }}
                                                className="text-slate-500 font-bold text-xs hover:text-indigo-600 transition"
                                            >
                                                รายละเอียด
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditModal(company)}
                                                className="text-indigo-600 font-bold text-xs hover:underline"
                                            >
                                                แก้ไข
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal สร้างบัญชีแอดมินบริษัท */}
            {isAdminModalOpen && targetCompany && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                        <h2 className="text-lg font-black text-slate-800">🔑 สร้างบัญชี Admin</h2>
                        <p className="text-sm text-slate-500 mt-1">สำหรับบริษัท: <span className="font-bold text-indigo-600">{targetCompany.name}</span></p>

                        <form onSubmit={handleCreateAdmin} className="mt-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อผู้ใช้งาน</label>
                                <input type="text" required value={adminData.name} onChange={(e) => setAdminData({ ...adminData, name: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="เช่น ผู้ดูแลระบบ" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">อีเมลสำหรับล็อกอิน</label>
                                <input type="email" required value={adminData.email} onChange={(e) => setAdminData({ ...adminData, email: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="admin@company.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">รหัสผ่านชั่วคราว</label>
                                <input type="text" required value={adminData.password} onChange={(e) => setAdminData({ ...adminData, password: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร" />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setIsAdminModalOpen(false)} className="flex-1 p-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition">ยกเลิก</button>
                                <button type="submit" disabled={isAdminSubmitting} className="flex-1 p-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition">
                                    {isAdminSubmitting ? 'กำลังสร้าง...' : 'ยืนยันการสร้างบัญชี'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal ดูรายละเอียดบริษัท */}
            {isViewModalOpen && viewCompany && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-black text-slate-800">{viewCompany.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm text-indigo-600 font-bold">รหัสบริษัท: {viewCompany.company_code || '-'}</p>
                                    {viewCompany.is_active
                                        ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">เปิดใช้งาน</span>
                                        : <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">ถูกระงับ</span>
                                    }
                                </div>
                            </div>
                            {/* 💡 ดึงค่าจาก package_tier มาแสดงผลใน Modal */}
                            {getPackageBadge(viewCompany.package_tier)}
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 mb-1">โควต้าพนักงาน</div>
                                    <div className="text-sm font-bold text-slate-700">{viewCompany.max_employees} คน</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 mb-1">วันหมดอายุ</div>
                                    <div className="text-sm font-bold text-slate-700">
                                        {viewCompany.expire_date ? new Date(viewCompany.expire_date).toLocaleDateString('th-TH') : 'ไม่กำหนด'}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 mb-1">เลขประจำตัวผู้เสียภาษี</div>
                                    <div className="text-sm font-bold text-slate-700">{viewCompany.tax_id || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 mb-1">ที่อยู่จดทะเบียน</div>
                                    <div className="text-sm font-medium text-slate-700 leading-relaxed">{viewCompany.address || '-'}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 mb-1">อีเมลติดต่อ</div>
                                        <div className="text-sm font-medium text-slate-700">{viewCompany.contact_email || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 mb-1">เบอร์โทรศัพท์</div>
                                        <div className="text-sm font-medium text-slate-700">{viewCompany.contact_phone || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-right">
                            <button
                                onClick={() => setIsViewModalOpen(false)}
                                className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal เพิ่ม/แก้ไข บริษัท */}
            {isFormModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            {isEditMode ? 'แก้ไขข้อมูลบริษัท' : 'เพิ่มบริษัทลูกค้าใหม่'}
                        </h2>
                        <form onSubmit={handleSaveCompany} className="space-y-4">

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">ข้อมูลพื้นฐานระบบ</h3>

                                    {/* ปุ่มสวิตช์สถานะ (Kill Switch) */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-slate-500">สถานะบริษัท:</label>
                                        <select
                                            value={formData.is_active ? 'true' : 'false'}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                            className={`text-xs font-bold rounded-lg p-1.5 border outline-none cursor-pointer
                        ${formData.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                                        >
                                            <option value="true">🟢 เปิดใช้งานปกติ</option>
                                            <option value="false">🔴 ระงับการใช้งาน</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">รหัสบริษัท (Code)</label>
                                        <input type="text" required placeholder="เช่น ABC" value={formData.company_code} onChange={(e) => setFormData({ ...formData, company_code: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">แพ็กเกจที่ใช้งาน</label>
                                        {/* 💡 ผูก Select ไว้กับ formData.package_tier */}
                                        <select value={formData.package_tier} onChange={(e) => setFormData({ ...formData, package_tier: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                                            <option value="trial">Trial</option>
                                            <option value="free">Free</option>
                                            <option value="basic">Basic</option>
                                            <option value="pro">Pro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">โควต้าพนักงาน (คน)</label>
                                        <input type="number" min="1" required value={formData.max_employees} onChange={(e) => setFormData({ ...formData, max_employees: Number(e.target.value) })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">วันหมดอายุ</label>
                                        <input type="date" value={formData.expire_date} onChange={(e) => setFormData({ ...formData, expire_date: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">ข้อมูลนิติบุคคลและการออกบิล</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อบริษัท (ตามจดทะเบียน)</label>
                                        <input type="text" required placeholder="บริษัท เอบีซี จำกัด" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">เลขประจำตัวผู้เสียภาษี (13 หลัก)</label>
                                        <input type="text" maxLength={13} placeholder="01055xxxxxxxx" value={formData.tax_id} onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">ที่อยู่บริษัท (สำหรับออกใบกำกับภาษี)</label>
                                    <textarea rows={2} placeholder="เลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">อีเมลผู้ติดต่อ</label>
                                        <input type="email" placeholder="admin@abc.com" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">เบอร์โทรศัพท์</label>
                                        <input type="tel" placeholder="0812345678" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsFormModalOpen(false)} className="flex-1 p-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition">ยกเลิก</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 p-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition">
                                    {isSubmitting ? 'กำลังบันทึก...' : (isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลบริษัท')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}