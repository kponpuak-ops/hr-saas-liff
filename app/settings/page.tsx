'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'structure' | 'work_hours' | 'holidays'>('work_hours')
    const [isLoading, setIsLoading] = useState<boolean>(true)

    // --- 1. Master Data State (โครงสร้างองค์กร) ---
    const [departments, setDepartments] = useState<any[]>([])
    const [positions, setPositions] = useState<any[]>([])
    const [benefits, setBenefits] = useState<any[]>([])
    const [newDept, setNewDept] = useState('')
    const [newPos, setNewPos] = useState('')
    const [newBenefit, setNewBenefit] = useState('')

    // --- 2. Work Hours, Shift & OT State ---
    const [hasShifts, setHasShifts] = useState<boolean>(false)
    const [defaultStartTime, setDefaultStartTime] = useState('08:30')
    const [defaultEndTime, setDefaultEndTime] = useState('17:30')
    const [lateBufferMinutes, setLateBufferMinutes] = useState(15)
    const [lateDeduction, setLateDeduction] = useState(0)
    const [shifts, setShifts] = useState<any[]>([])
    
    // สเตทสำหรับเก็บค่า OT
    const [otRateNormal, setOtRateNormal] = useState<number>(1.5)
    const [otRateHolidayWork, setOtRateHolidayWork] = useState<number>(2.0)
    const [otRateHolidayOt, setOtRateHolidayOt] = useState<number>(3.0)
    
    const [isSavingSettings, setIsSavingSettings] = useState(false)

    const [newShift, setNewShift] = useState({
        shift_name: '',
        start_time: '08:00',
        end_time: '17:00',
        late_buffer_minutes: 10,
        late_deduction_per_minute: 0,
    })

    // --- 3. Social Security State (ประกันสังคม) ---
    const [ssEnabled, setSsEnabled] = useState<boolean>(true)
    const [ssEmployeeRate, setSsEmployeeRate] = useState<number>(5.0)
    const [ssEmployerRate, setSsEmployerRate] = useState<number>(5.0)
    const [ssMinSalary, setSsMinSalary] = useState<number>(1650)
    const [ssMaxSalary, setSsMaxSalary] = useState<number>(15000)

    // --- 4. Holiday Calendar State ---
    const [holidays, setHolidays] = useState<any[]>([])
    const [newHoliday, setNewHoliday] = useState({
        holiday_date: '',
        name: '',
        type: 'traditional',
        ot_rate: 2.0,
    })

    useEffect(() => {
        fetchAllData()
    }, [])

    const fetchAllData = async () => {
        setIsLoading(true)
        await Promise.all([
            fetchMasterData(),
            fetchWorkSettings(),
            fetchShifts(),
            fetchHolidays(),
        ])
        setIsLoading(false)
    }

    // --- Fetchers ---
    const fetchMasterData = async () => {
        const { data: deptData } = await supabase.from('departments').select('*').order('id', { ascending: true })
        const { data: posData } = await supabase.from('positions').select('*').order('id', { ascending: true })
        const { data: benData } = await supabase.from('benefit_master').select('*').order('id', { ascending: true })
        if (deptData) setDepartments(deptData)
        if (posData) setPositions(posData)
        if (benData) setBenefits(benData)
    }

    const fetchWorkSettings = async () => {
        const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single()
        if (data) {
            setHasShifts(data.has_shifts)
            setDefaultStartTime(data.default_start_time?.substring(0, 5) || '08:30')
            setDefaultEndTime(data.default_end_time?.substring(0, 5) || '17:30')
            setLateBufferMinutes(data.late_buffer_minutes || 0)
            setLateDeduction(data.late_deduction_per_minute || 0)

            // ดึงค่า OT
            setOtRateNormal(data.ot_rate_normal ?? 1.5)
            setOtRateHolidayWork(data.ot_rate_holiday_work ?? 2.0)
            setOtRateHolidayOt(data.ot_rate_holiday_ot ?? 3.0)

            // ดึงค่าประกันสังคม
            setSsEnabled(data.ss_enabled ?? true)
            setSsEmployeeRate(data.ss_employee_rate ?? 5.0)
            setSsEmployerRate(data.ss_employer_rate ?? 5.0)
            setSsMinSalary(data.ss_min_salary ?? 1650)
            setSsMaxSalary(data.ss_max_salary ?? 15000)
        }
    }

    const fetchShifts = async () => {
        const { data } = await supabase.from('work_shifts').select('*').order('id', { ascending: true })
        if (data) setShifts(data)
    }

    const fetchHolidays = async () => {
        const { data } = await supabase.from('company_holidays').select('*').order('holiday_date', { ascending: true })
        if (data) setHolidays(data)
    }

    // --- Handlers: Work Settings & Social Security ---
    const handleSaveWorkSettings = async () => {
        setIsSavingSettings(true)
        const { error } = await supabase.from('company_settings').upsert({
            id: 1,
            has_shifts: hasShifts,
            default_start_time: defaultStartTime,
            default_end_time: defaultEndTime,
            late_buffer_minutes: lateBufferMinutes,
            late_deduction_per_minute: lateDeduction,
            ot_rate_normal: otRateNormal,
            ot_rate_holiday_work: otRateHolidayWork,
            ot_rate_holiday_ot: otRateHolidayOt,
            ss_enabled: ssEnabled,
            ss_employee_rate: ssEmployeeRate,
            ss_employer_rate: ssEmployerRate,
            ss_min_salary: ssMinSalary,
            ss_max_salary: ssMaxSalary,
            updated_at: new Date().toISOString(),
        })

        if (error) alert('บันทึกไม่สำเร็จ: ' + error.message)
        else alert('บันทึกการตั้งค่าเรียบร้อยแล้ว')
        setIsSavingSettings(false)
    }

    const handleAddShift = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newShift.shift_name.trim()) return

        const { error } = await supabase.from('work_shifts').insert([newShift])
        if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
        else {
            setNewShift({
                shift_name: '',
                start_time: '08:00',
                end_time: '17:00',
                late_buffer_minutes: 10,
                late_deduction_per_minute: 0
            })
            fetchShifts()
        }
    }

    const handleDeleteShift = async (id: number) => {
        if (!confirm('ยืนยันการลบกะการทำงานนี้?')) return
        const { error } = await supabase.from('work_shifts').delete().eq('id', id)
        if (!error) fetchShifts()
    }

    // --- Handlers: Holidays ---
    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newHoliday.holiday_date || !newHoliday.name.trim()) {
            alert('กรุณากรอกวันที่และชื่อวันหยุด')
            return
        }

        const { error } = await supabase.from('company_holidays').insert([newHoliday])
        if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
        else {
            setNewHoliday({ holiday_date: '', name: '', type: 'traditional', ot_rate: 2.0 })
            fetchHolidays()
        }
    }

    const handleDeleteHoliday = async (id: number) => {
        if (!confirm('ยืนยันการลบวันหยุดนี้?')) return
        const { error } = await supabase.from('company_holidays').delete().eq('id', id)
        if (!error) fetchHolidays()
    }

    // --- Handlers: Master Data ---
    const handleAddMaster = async (table: string, fieldName: string, value: string, resetFn: () => void) => {
        if (!value.trim()) return
        const { error } = await supabase.from(table).insert([{ [fieldName]: value.trim() }])
        if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
        else {
            resetFn()
            fetchMasterData()
        }
    }

    const handleDeleteMaster = async (table: string, id: number) => {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (!error) fetchMasterData()
    }

    if (isLoading) return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูลการตั้งค่า...</div>

    return (
        <div className="pb-12">
            {/* ปรับส่วนหัวให้มีปุ่มจัดการประเภทการลา */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">ตั้งค่าองค์กร (Organization Settings)</h1>
                    <p className="text-slate-500 text-sm">กำหนดเวลาทำงาน ระบบกะ ประกันสังคม ปฏิทินวันหยุด และโครงสร้างองค์กร</p>
                </div>
                <Link 
                    href="/settings/leave-types" 
                    className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all"
                >
                    <span className="text-lg">📝</span> จัดการประเภทการลา
                </Link>
            </div>

            {/* ปุ่มสลับแท็บ */}
            <div className="flex border-b border-slate-200 mb-6 gap-2">
                <button
                    onClick={() => setActiveTab('work_hours')}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'work_hours'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                >
                    ⏰ เวลาทำงาน, OT & ประกันสังคม
                </button>
                <button
                    onClick={() => setActiveTab('holidays')}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'holidays'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                >
                    📅 ปฏิทินวันหยุดองค์กร
                </button>
                <button
                    onClick={() => setActiveTab('structure')}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'structure'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                >
                    🏢 โครงสร้างองค์กร (แผนก/ตำแหน่ง)
                </button>
            </div>

            {/* TABS 1: เวลาทำงาน, OT & ประกันสังคม */}
            {activeTab === 'work_hours' && (
                <div className="space-y-6 animate-fade-in">
                    
                    {/* กล่องตั้งค่าเข้างาน */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            ⚙️ รูปแบบการเข้างานของบริษัท
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <label
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${!hasShifts ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="shift_type"
                                    checked={!hasShifts}
                                    onChange={() => setHasShifts(false)}
                                    className="mt-1 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">ไม่มีกะ (เวลาทำงานเข้า-ออก ฟิกซ์แน่นอน)</div>
                                    <div className="text-xs text-slate-500 mt-0.5">พนักงานทุกคนใช้เวลาเข้า-เลิกงานมาตรฐานเดียวกันทั้งบริษัท</div>
                                </div>
                            </label>

                            <label
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${hasShifts ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="shift_type"
                                    checked={hasShifts}
                                    onChange={() => setHasShifts(true)}
                                    className="mt-1 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">มีกะการทำงาน (Multi-Shift)</div>
                                    <div className="text-xs text-slate-500 mt-0.5">มีหลายกะเวลา เช่น กะเช้า, กะบ่าย, กะดึก เหมาะกับโรงงานหรือร้านค้า</div>
                                </div>
                            </label>
                        </div>

                        {!hasShifts ? (
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                                <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">ตั้งค่าเวลาทำงานปกติ</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาเข้างานมาตรฐาน</label>
                                        <input
                                            type="time"
                                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={defaultStartTime}
                                            onChange={(e) => setDefaultStartTime(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาเลิกงานมาตรฐาน</label>
                                        <input
                                            type="time"
                                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={defaultEndTime}
                                            onChange={(e) => setDefaultEndTime(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">อนุญาตให้เข้าสายได้ (นาที)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={lateBufferMinutes}
                                            onChange={(e) => setLateBufferMinutes(Number(e.target.value))}
                                        />
                                        <span className="text-[11px] text-slate-400 mt-1 block">ยืดหยุ่นสายได้ไม่โดนหัก</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">หักเงินสาย (บาท/นาที)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full p-2.5 border border-rose-300 bg-rose-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500 text-rose-700 font-bold"
                                            value={lateDeduction}
                                            onChange={(e) => setLateDeduction(Number(e.target.value))}
                                        />
                                        <span className="text-[11px] text-rose-500 mt-1 block">ตัวอย่าง: นาทีละ 5 บาท</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                                <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">➕ เพิ่มกะการทำงานใหม่</h3>
                                <form onSubmit={handleAddShift} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อกะ</label>
                                        <input
                                            type="text"
                                            placeholder="เช่น กะเช้า / กะดึก"
                                            required
                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                                            value={newShift.shift_name}
                                            onChange={(e) => setNewShift({ ...newShift, shift_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาเริ่มกะ</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                                            value={newShift.start_time}
                                            onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาสิ้นสุดกะ</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                                            value={newShift.end_time}
                                            onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">ยืดหยุ่นสาย (นาที)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                                            value={newShift.late_buffer_minutes}
                                            onChange={(e) => setNewShift({ ...newShift, late_buffer_minutes: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">หักเงินสาย (บาท/นาที)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full p-2 border border-rose-300 bg-rose-50 rounded-lg text-sm outline-none text-rose-700 font-bold"
                                                value={newShift.late_deduction_per_minute}
                                                onChange={(e) => setNewShift({ ...newShift, late_deduction_per_minute: Number(e.target.value) })}
                                            />
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs whitespace-nowrap"
                                            >
                                                เพิ่มกะ
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <span className="text-xs font-bold text-slate-700 block mb-2">รายการกะทั้งหมดในระบบ:</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {shifts.map((s) => (
                                            <div key={s.id} className="p-3 bg-white border border-slate-200 rounded-lg flex justify-between items-center shadow-sm">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{s.shift_name}</div>
                                                    <div className="text-xs text-slate-500">
                                                        เวลา: {s.start_time?.substring(0, 5)} - {s.end_time?.substring(0, 5)} น. (สายได้ {s.late_buffer_minutes ?? 0} นาที • <span className="text-rose-600 font-semibold">หัก {s.late_deduction_per_minute ?? 0} ฿/นาที</span>)
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteShift(s.id)}
                                                    className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                        {shifts.length === 0 && <span className="text-xs text-slate-400 italic">ยังไม่มีการเพิ่มกะ</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 💰 กล่องตั้งค่า OT (ใหม่) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            💰 อัตราค่าล่วงเวลา (OT)
                        </h2>
                        <p className="text-xs text-slate-500 mb-4">กำหนดตัวคูณอัตราค่าจ้างต่อชั่วโมงสำหรับการทำงานล่วงเวลา (อ้างอิงตามกฎหมายแรงงาน)</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="block text-xs font-bold text-indigo-900 mb-1">OT วันทำงานปกติ (เท่า)</label>
                                <input 
                                    type="number" 
                                    step="0.5" 
                                    min="0" 
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    value={otRateNormal} 
                                    onChange={(e) => setOtRateNormal(Number(e.target.value))} 
                                />
                                <span className="text-[11px] text-slate-500 mt-2 block">ทำหลังเวลาเลิกงานปกติ (มาตรฐาน 1.5 เท่า)</span>
                            </div>
                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                <label className="block text-xs font-bold text-emerald-900 mb-1">ทำงานในวันหยุด (เท่า)</label>
                                <input 
                                    type="number" 
                                    step="0.5" 
                                    min="0" 
                                    className="w-full p-2.5 border border-emerald-300 rounded-lg text-sm bg-white font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={otRateHolidayWork} 
                                    onChange={(e) => setOtRateHolidayWork(Number(e.target.value))} 
                                />
                                <span className="text-[11px] text-slate-500 mt-2 block">ทำในเวลาปกติของวันหยุด (มาตรฐาน 1.0 หรือ 2.0 เท่า)</span>
                            </div>
                            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                                <label className="block text-xs font-bold text-rose-900 mb-1">OT วันหยุด (เท่า)</label>
                                <input 
                                    type="number" 
                                    step="0.5" 
                                    min="0" 
                                    className="w-full p-2.5 border border-rose-300 rounded-lg text-sm bg-white font-bold text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none" 
                                    value={otRateHolidayOt} 
                                    onChange={(e) => setOtRateHolidayOt(Number(e.target.value))} 
                                />
                                <span className="text-[11px] text-slate-500 mt-2 block">ทำหลังเวลาเลิกงานในวันหยุด (มาตรฐาน 3.0 เท่า)</span>
                            </div>
                        </div>
                    </div>

                    {/* กล่องตั้งค่าประกันสังคม */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-800">🛡️ การตั้งค่าประกันสังคม (Social Security)</h2>
                                <p className="text-xs text-slate-500 mt-0.5">กำหนดอัตราหักและฐานเงินเดือนตามกฎหมายประกันสังคม</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                <input
                                    type="checkbox"
                                    checked={ssEnabled}
                                    onChange={(e) => setSsEnabled(e.target.checked)}
                                    className="w-4 h-4 accent-indigo-600 rounded"
                                />
                                <span className="text-xs font-bold text-slate-700">เปิดใช้งานคำนวณประกันสังคม</span>
                            </label>
                        </div>

                        {ssEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">หักฝั่งพนักงาน (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                        value={ssEmployeeRate}
                                        onChange={(e) => setSsEmployeeRate(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">สมทบฝั่งนายจ้าง (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                        value={ssEmployerRate}
                                        onChange={(e) => setSsEmployerRate(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">ฐานเงินเดือนต่ำสุด (บาท)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                        value={ssMinSalary}
                                        onChange={(e) => setSsMinSalary(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">ฐานเงินเดือนสูงสุด (บาท)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full p-2.5 border border-indigo-300 bg-indigo-50/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                                        value={ssMaxSalary}
                                        onChange={(e) => setSsMaxSalary(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveWorkSettings}
                            disabled={isSavingSettings}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md"
                        >
                            {isSavingSettings ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่าทั้งหมด'}
                        </button>
                    </div>
                </div>
            )}
            
            {/* TABS 2: ปฏิทินวันหยุดองค์กร */}
            {activeTab === 'holidays' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            📅 เพิ่มวันหยุดในปฏิทินบริษัท
                        </h2>

                        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่หยุด *</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newHoliday.holiday_date}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อวันหยุด / รายละเอียด *</label>
                                <input
                                    type="text"
                                    placeholder="เช่น วันสงกรานต์ / วันหยุดบริษัท"
                                    required
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newHoliday.name}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">ประเภทวันหยุด</label>
                                <select
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newHoliday.type}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}
                                >
                                    <option value="weekly">วันหยุดประจำสัปดาห์ (Weekly)</option>
                                    <option value="traditional">วันหยุดประเพณี/นักขัตฤกษ์ (Traditional)</option>
                                    <option value="company">วันหยุดพิเศษบริษัท (Company Holiday)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">อัตราคูณ OT (เท่า)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    required
                                    className="w-full p-2.5 border border-indigo-300 bg-indigo-50/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                                    value={newHoliday.ot_rate}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, ot_rate: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-all shadow"
                                >
                                    ➕ เพิ่มวันหยุด
                                </button>
                            </div>
                        </form>

                        <h3 className="font-bold text-sm text-slate-800 mb-3">รายการวันหยุดทั้งหมดในระบบ</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                        <th className="pb-3">วันที่</th>
                                        <th className="pb-3">ชื่อวันหยุด</th>
                                        <th className="pb-3">ประเภทวันหยุด</th>
                                        <th className="pb-3 text-center">อัตราคูณ OT</th>
                                        <th className="pb-3 text-right">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {holidays.map((h) => (
                                        <tr key={h.id} className="hover:bg-slate-50">
                                            <td className="py-3 font-semibold text-slate-800">
                                                {new Date(h.holiday_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </td>
                                            <td className="py-3 font-medium text-slate-700">{h.name}</td>
                                            <td className="py-3">
                                                {h.type === 'weekly' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">วันหยุดประจำสัปดาห์</span>}
                                                {h.type === 'traditional' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">วันหยุดประเพณี</span>}
                                                {h.type === 'company' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">วันหยุดพิเศษบริษัท</span>}
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    {h.ot_rate ?? 2.0} เท่า
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteHoliday(h.id)}
                                                    className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1"
                                                >
                                                    🗑️ ลบ
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {holidays.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-6 text-center text-slate-400">ยังไม่มีข้อมูลวันหยุดในปฏิทิน</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TABS 3: โครงสร้างองค์กร */}
            {activeTab === 'structure' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">🏢 รายชื่อแผนก</h2>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="ชื่อแผนกใหม่..."
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none"
                                value={newDept}
                                onChange={(e) => setNewDept(e.target.value)}
                            />
                            <button
                                onClick={() => handleAddMaster('departments', 'name', newDept, () => setNewDept(''))}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
                            >
                                เพิ่ม
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {departments.map((d) => (
                                <li key={d.id} className="py-2.5 flex justify-between items-center text-slate-700">
                                    <span>{d.name}</span>
                                    <button onClick={() => handleDeleteMaster('departments', d.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">🗑️</button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">💼 ตำแหน่งงาน</h2>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="ชื่อตำแหน่งใหม่..."
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none"
                                value={newPos}
                                onChange={(e) => setNewPos(e.target.value)}
                            />
                            <button
                                onClick={() => handleAddMaster('positions', 'title', newPos, () => setNewPos(''))}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
                            >
                                เพิ่ม
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {positions.map((p) => (
                                <li key={p.id} className="py-2.5 flex justify-between items-center text-slate-700">
                                    <span>{p.title}</span>
                                    <button onClick={() => handleDeleteMaster('positions', p.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">🗑️</button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">🎁 ประเภทสวัสดิการ</h2>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="สวัสดิการใหม่..."
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none"
                                value={newBenefit}
                                onChange={(e) => setNewBenefit(e.target.value)}
                            />
                            <button
                                onClick={() => handleAddMaster('benefit_master', 'name', newBenefit, () => setNewBenefit(''))}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
                            >
                                เพิ่ม
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {benefits.map((b) => (
                                <li key={b.id} className="py-2.5 flex justify-between items-center text-slate-700">
                                    <span>{b.name}</span>
                                    <button onClick={() => handleDeleteMaster('benefit_master', b.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">🗑️</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}