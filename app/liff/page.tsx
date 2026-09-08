'use client'

import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function LiffPage() {
    const [isLiffReady, setIsLiffReady] = useState(false)
    const [lineProfile, setLineProfile] = useState<{ userId: string; displayName: string } | null>(null)

    // สถานะหน้าจอ: 'loading' = กำลังโหลด, 'bind' = หน้าผูกบัญชี, 'attendance' = หน้าลงเวลา
    const [view, setView] = useState<'loading' | 'bind' | 'attendance'>('loading')

    // ข้อมูลพนักงานและการลงเวลา
    const [employee, setEmployee] = useState<any>(null)
    const [attendanceToday, setAttendanceToday] = useState<any>(null)

    // ฟอร์มผูกบัญชี
    const [bindingCode, setBindingCode] = useState('')
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // ดึงวันที่ปัจจุบันแบบโซนเวลาไทย (YYYY-MM-DD)
    const getTodayString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    useEffect(() => {
        const initLiff = async () => {
            try {
                await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' })
                if (!liff.isLoggedIn()) {
                    liff.login()
                } else {
                    const profile = await liff.getProfile()
                    setLineProfile({ userId: profile.userId, displayName: profile.displayName })
                    checkUserBinding(profile.userId) // เช็กว่าเคยผูกบัญชีไหม
                    setIsLiffReady(true)
                }
            } catch (err) {
                console.error('LIFF Init Error:', err)
                setMessage('ไม่สามารถเชื่อมต่อระบบ LINE ได้')
                setView('bind')
            }
        }
        initLiff()
    }, [])

    // ฟังก์ชันตรวจสอบการผูกบัญชีและดึงข้อมูลลงเวลา
    const checkUserBinding = async (lineUid: string) => {
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('line_user_id', lineUid)
            .single()

        if (user) {
            setEmployee(user)
            await fetchTodayAttendance(user.id)
            setView('attendance')
        } else {
            setView('bind')
        }
    }

    // ฟังก์ชันดึงประวัติลงเวลาของวันนี้
    const fetchTodayAttendance = async (userId: number) => {
        const today = getTodayString()
        const { data } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('action_date', today)
            .single()

        setAttendanceToday(data)
    }

    // --- ส่วนฟังก์ชันผูกบัญชี (นำรหัส 6 หลักมายืนยัน) ---
    const handleBind = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!lineProfile) return
        setIsLoading(true)
        setMessage('')

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('binding_code', bindingCode)
            .single()

        if (error || !data) {
            setMessage('❌ รหัสไม่ถูกต้อง หรือถูกใช้งานไปแล้ว')
            setIsLoading(false)
            return
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ line_user_id: lineProfile.userId, binding_code: null })
            .eq('id', data.id)

        setIsLoading(false)

        if (updateError) {
            setMessage('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        } else {
            checkUserBinding(lineProfile.userId) // ผูกสำเร็จให้สลับไปหน้าลงเวลา
        }
    }

    // --- ส่วนฟังก์ชันลงเวลาเข้า-ออก ---
    const handleCheckIn = async () => {
        setIsLoading(true)
        const today = getTodayString()
        const now = new Date().toISOString()

        const { error } = await supabase.from('attendance').insert({
            user_id: employee.id,
            action_date: today,
            check_in_time: now
        })

        if (error) {
            alert(`❌ บันทึกไม่สำเร็จ: ${error.message}`)
        } else {
            await fetchTodayAttendance(employee.id)
        }
        setIsLoading(false)
    }

    const handleCheckOut = async () => {
        setIsLoading(true)
        const today = getTodayString()
        const now = new Date().toISOString()

        const { error } = await supabase.from('attendance').update({
            check_out_time: now
        })
            .eq('user_id', employee.id)
            .eq('action_date', today)

        if (error) {
            alert(`❌ บันทึกไม่สำเร็จ: ${error.message}`)
        } else {
            await fetchTodayAttendance(employee.id)
        }
        setIsLoading(false)
    }

    // --- ส่วนแสดงผล UI ---
    if (view === 'loading') {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">กำลังโหลดข้อมูล...</div>
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 border border-slate-100 relative overflow-hidden">

                {/* หน้าจอ 1: ผูกบัญชี */}
                {view === 'bind' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-indigo-500 text-white rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm">📱</div>
                            <h1 className="text-2xl font-bold text-slate-800">ลงทะเบียนพนักงาน</h1>
                            <p className="text-slate-500 text-sm mt-2">กรุณากรอกรหัส 6 หลักที่ได้รับจาก HR</p>
                        </div>

                        <form onSubmit={handleBind} className="space-y-5">
                            <input
                                type="text"
                                placeholder="รหัส 6 หลัก"
                                maxLength={6}
                                required
                                value={bindingCode}
                                onChange={(e) => setBindingCode(e.target.value)}
                                className="w-full text-center text-3xl tracking-[0.3em] font-mono border-2 border-slate-200 rounded-xl px-4 py-4 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                            {message && <div className="p-3 rounded-xl text-sm text-center font-bold bg-red-100 text-red-600">{message}</div>}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                                {isLoading ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส'}
                            </button>
                        </form>
                    </div>
                )}

                {/* หน้าจอ 2: ระบบลงเวลา */}
                {view === 'attendance' && employee && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border-4 border-white shadow-md">
                                👤
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800">{employee.first_name} {employee.last_name}</h1>
                            <p className="text-slate-500 font-medium">{employee.role}</p>
                        </div>

                        <div className="space-y-4">
                            {/* สเตป 1: ยังไม่เข้างาน */}
                            {!attendanceToday && (
                                <button
                                    onClick={handleCheckIn}
                                    disabled={isLoading}
                                    className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-5 rounded-2xl font-bold text-xl transition-all active:scale-95 shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                                >
                                    📥 ลงเวลาเข้างาน
                                </button>
                            )}

                            {/* สเตป 2: เข้างานแล้ว แต่ยังไม่ออก */}
                            {attendanceToday && !attendanceToday.check_out_time && (
                                <div className="space-y-4">
                                    <div className="bg-green-50 text-green-700 p-4 rounded-2xl text-center border border-green-100">
                                        <p className="text-sm font-medium mb-1">เข้างานเมื่อ</p>
                                        <p className="text-2xl font-bold font-mono">
                                            {new Date(attendanceToday.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCheckOut}
                                        disabled={isLoading}
                                        className="w-full bg-rose-500 hover:bg-rose-600 text-white py-5 rounded-2xl font-bold text-xl transition-all active:scale-95 shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                                    >
                                        📤 ลงเวลาออกงาน
                                    </button>
                                </div>
                            )}

                            {/* สเตป 3: ลงเวลาออกงานแล้ว */}
                            {attendanceToday && attendanceToday.check_out_time && (
                                <div className="bg-slate-50 text-slate-600 p-6 rounded-2xl text-center border border-slate-200">
                                    <div className="text-4xl mb-3">🎉</div>
                                    <h3 className="font-bold text-lg text-slate-800 mb-1">คุณลงเวลาครบแล้ววันนี้</h3>
                                    <p className="text-sm">พักผ่อนให้เต็มที่ เจอกันใหม่พรุ่งนี้ครับ!</p>
                                    <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-400 font-mono">
                                        เข้า: {new Date(attendanceToday.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} |
                                        ออก: {new Date(attendanceToday.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            )}

                            {/* ปุ่มยื่นใบลา (แสดงผลตลอดเวลา) */}
                            <Link
                                href="/liff/leave"
                                className="block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl transition-colors mt-4"
                            >
                                📝 ยื่นใบลา
                            </Link>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}