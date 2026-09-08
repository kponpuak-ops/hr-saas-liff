'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import Link from 'next/link' // เพิ่มการใช้งาน Link

export default function LiffAttendancePage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // Settings & Shift state
  const [hasShifts, setHasShifts] = useState<boolean>(false)
  const [shifts, setShifts] = useState<any[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)

  // Attendance status state
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isCompletedToday, setIsCompletedToday] = useState(false)

  useEffect(() => {
    initLiffData()
  }, [])

  const initLiffData = async () => {
    setLoading(true)
    try {
      // 1. เริ่มทำงาน LIFF และเช็กการล็อกอิน LINE
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' })
      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      // 2. ดึง LINE Profile ของผู้ใช้งานปัจจุบัน
      const profile = await liff.getProfile()

      // 3. ดึงการตั้งค่าบริษัท
      const { data: settings } = await supabase
        .from('company_settings')
        .select('has_shifts')
        .eq('id', 1)
        .single()

      const isShiftEnabled = settings?.has_shifts ?? false
      setHasShifts(isShiftEnabled)

      // 4. ถ้าเปิดระบบกะ ให้ดึงรายการกะทั้งหมดมาเตรียมไว้
      if (isShiftEnabled) {
        const { data: shiftData } = await supabase
          .from('work_shifts')
          .select('*')
          .order('id', { ascending: true })

        if (shiftData && shiftData.length > 0) {
          setShifts(shiftData)
          setSelectedShiftId(shiftData[0].id)
        }
      }

      // 5. ค้นหาข้อมูลพนักงานในตาราง users ผ่าน line_user_id จริง
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('line_user_id', profile.userId)
        .maybeSingle()

      // 🛑 ถ้าไม่พบข้อมูลพนักงาน (ยังไม่ได้ผูก LINE) -> ส่งไปหน้า /bind ทันที
      if (!userData) {
        window.location.href = '/bind'
        return
      }

      setUser(userData)
      await checkAttendanceStatus(userData.id, isShiftEnabled)
    } catch (err: any) {
      console.error('Error loading LIFF:', err.message)
    } finally {
      setLoading(false)
    }
  }

  // ตรวจสอบสถานะการลงเวลาปัจจุบัน
  const checkAttendanceStatus = async (userId: string, isShiftEnabled: boolean) => {
    if (!isShiftEnabled) {
      // --- เคสไม่มีกะ: เช็กเรคคอร์ดของวันนี้ ---
      const today = new Date().toISOString().split('T')[0]
      const { data: todayRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('action_date', today)
        .maybeSingle()

      if (todayRecord) {
        if (todayRecord.check_out_time) {
          setIsCompletedToday(true)
          setActiveRecord(null)
        } else {
          setActiveRecord(todayRecord)
          setIsCompletedToday(false)
        }
      } else {
        setActiveRecord(null)
        setIsCompletedToday(false)
      }
    } else {
      // --- เคสมีกะ: เช็ก Active Session ล่าสุดที่ยังไม่กดออก ---
      const { data: lastRecord } = await supabase
        .from('attendance')
        .select('*, work_shifts(*)')
        .eq('user_id', userId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastRecord && !lastRecord.check_out_time) {
        setActiveRecord(lastRecord)
      } else {
        setActiveRecord(null)
      }
      setIsCompletedToday(false)
    }
  }

  // กดปุ่มลงเวลาเข้างาน
  const handleCheckIn = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const now = new Date()
      const todayDate = now.toISOString().split('T')[0]

      const payload: any = {
        user_id: user.id,
        action_date: todayDate,
        check_in_time: now.toISOString(),
      }

      if (hasShifts && selectedShiftId) {
        payload.shift_id = selectedShiftId
      }

      const { error } = await supabase.from('attendance').insert([payload])

      if (error) throw error

      alert('🟢 ลงเวลาเข้างานเรียบร้อยแล้ว!')
      await checkAttendanceStatus(user.id, hasShifts)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // กดปุ่มลงเวลาออกงาน
  const handleCheckOut = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const now = new Date()

      let query = supabase
        .from('attendance')
        .update({ check_out_time: now.toISOString() })

      if (activeRecord?.id) {
        query = query.eq('id', activeRecord.id)
      } else {
        query = query.eq('user_id', user.id).is('check_out_time', null)
      }

      const { error } = await query

      if (error) throw error

      alert('🔴 ลงเวลาออกงานเรียบร้อยแล้ว!')
      await checkAttendanceStatus(user.id, hasShifts)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลระบบลงเวลา...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto flex flex-col justify-between pb-8">
      {/* ส่วนหัวแสดงโปรไฟล์พนักงาน */}
      <div>
        <div className="bg-indigo-600 text-white rounded-3xl p-6 shadow-lg mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl overflow-hidden border-2 border-white/40">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.first_name?.[0] || '👤'
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold">{user?.first_name} {user?.last_name}</h1>
              <p className="text-xs text-indigo-100">{user?.position || 'พนักงาน'} • ID: {user?.employee_id || '-'}</p>
            </div>
          </div>
        </div>

        {/* บัตรแสดงสถานะการลงเวลา */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">โหมดลงเวลา</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              hasShifts ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {hasShifts ? '🏭 ระบบมีกะการทำงาน' : '🏢 เวลาฟิกซ์มาตรฐาน'}
            </span>
          </div>

          {/* กรณี 1: กำลังทำงานอยู่ (Check-in ค้างไว้) */}
          {activeRecord ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1">
              <span className="text-xs text-emerald-600 font-bold">🟢 สถานะ: กำลังปฏิบัติงาน</span>
              {activeRecord.work_shifts && (
                <p className="text-sm font-bold text-slate-800">
                  กะ: {activeRecord.work_shifts.shift_name} ({activeRecord.work_shifts.start_time?.substring(0, 5)} - {activeRecord.work_shifts.end_time?.substring(0, 5)} น.)
                </p>
              )}
              <p className="text-xs text-slate-500">
                เข้างานเมื่อ: {new Date(activeRecord.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              </p>
            </div>
          ) : isCompletedToday ? (
            /* กรณี 2: แบบไม่มีกะ และกดลงเวลาครบแล้วสำหรับวันนี้ */
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
              <span className="text-xs text-slate-500 font-bold">✅ ลงเวลาเข้า-ออกงาน ครบถ้วนแล้ววันนี้</span>
            </div>
          ) : (
            /* กรณี 3: ยังไม่ได้กดเข้างาน */
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <span className="text-xs text-amber-700 font-bold">⏰ ยังไม่ได้ลงเวลาเข้างาน</span>
            </div>
          )}

          {/* ถ้ามีกะ และยังไม่ได้กดเข้างาน -> โชว์ตัวเลือกกะ */}
          {hasShifts && !activeRecord && (
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">เลือกกะการทำงานที่จะเข้า:</label>
              <select
                className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedShiftId || ''}
                onChange={(e) => setSelectedShiftId(Number(e.target.value))}
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shift_name} ({s.start_time?.substring(0, 5)} - {s.end_time?.substring(0, 5)} น.)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* เมนูลัด (Quick Actions) */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-sm shadow-sm hover:bg-slate-50 flex flex-col items-center gap-2 transition-colors" href="/liff/leave">
            <span className="text-2xl">📝</span>
            <span className="text-xs">ยื่นใบลา</span>
          </Link>
          <Link className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-sm shadow-sm hover:bg-slate-50 flex flex-col items-center gap-2 transition-colors" href="/liff/history">
            <span className="text-2xl">📋</span>
            <span className="text-xs text-center">ประวัติการลา</span>
          </Link>
          <Link className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-sm shadow-sm hover:bg-slate-50 flex flex-col items-center gap-2 transition-colors" href="/liff/ot">
            <span className="text-2xl">⏱️</span>
            <span className="text-xs text-center">ยื่นขอ OT</span>
          </Link>
          <Link className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold text-sm shadow-sm hover:bg-slate-50 flex flex-col items-center gap-2 transition-colors" href="/liff/ot-history">
            <span className="text-2xl">⏳</span>
            <span className="text-xs text-center">ประวัติ OT</span>
          </Link>
        </div>
      </div>

      {/* ปุ่มกด Action หลัก */}
      <div className="mt-8">
        {activeRecord ? (
          <button
            onClick={handleCheckOut}
            disabled={submitting}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-2xl text-lg shadow-lg shadow-rose-200 transition-all disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : '🔴 ลงเวลาออกงาน'}
          </button>
        ) : isCompletedToday ? (
          <button
            disabled
            className="w-full py-4 bg-slate-300 text-slate-500 font-bold rounded-2xl text-lg cursor-not-allowed"
          >
            ลงเวลาครบแล้วสำหรับวันนี้
          </button>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={submitting || (hasShifts && !selectedShiftId)}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-lg shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : '🟢 ลงเวลาเข้างาน'}
          </button>
        )}
      </div>
    </div>
  )
}