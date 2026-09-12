'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import Link from 'next/link'

export default function LiffAttendancePage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // Settings & Shift state
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)

  // Attendance status state
  const [activeRecord, setActiveRecord] = useState<any>(null)
  const [isCompletedToday, setIsCompletedToday] = useState(false)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0)

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    initLiffData()
  }, [])

  const initLiffData = async () => {
    setLoading(true)
    try {
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' })
      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      const profile = await liff.getProfile()

      // 1. ดึงข้อมูลพนักงานก่อน เพื่อเอา company_id
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('line_user_id', profile.userId)
        .maybeSingle()

      if (!userData) {
        window.location.href = '/bind'
        return
      }
      setUser(userData)

      // 2. ดึงการตั้งค่าบริษัทตาม company_id
      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', userData.company_id)
        .single()
      
      setCompanySettings(settings || {})

      // 3. ดึงข้อมูลกะ (ถ้าเปิดใช้งาน)
      if (settings?.has_shifts) {
        const { data: shiftData } = await supabase
          .from('work_shifts')
          .select('*')
          .eq('company_id', userData.company_id)
          .order('id', { ascending: true })

        if (shiftData && shiftData.length > 0) {
          setShifts(shiftData)
          setSelectedShiftId(shiftData[0].id)
        }
      }

      await checkAttendanceStatus(userData.id, settings?.has_shifts)
      
      if (userData.role === 'manager' || userData.role === 'admin') {
         await fetchPendingCount(userData.company_id, userData.department, userData.role)
      }

    } catch (err: any) {
      console.error('Error loading LIFF:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingCount = async (companyId: number, department: string, role: string) => {
    let leaveQuery = supabase.from('leaves').select('id, users!inner(company_id, department, role)', { count: 'exact' }).eq('status', 'pending').eq('users.company_id', companyId)
    let otQuery = supabase.from('ot_requests').select('id, users!inner(company_id, department, role)', { count: 'exact' }).eq('status', 'pending').eq('users.company_id', companyId)

    if (role === 'manager') {
      leaveQuery = leaveQuery.eq('users.department', department).eq('users.role', 'staff')
      otQuery = otQuery.eq('users.department', department).eq('users.role', 'staff')
    }

    const [leaveRes, otRes] = await Promise.all([leaveQuery, otQuery])
    setPendingApprovalsCount((leaveRes.count || 0) + (otRes.count || 0))
  }

  const checkAttendanceStatus = async (userId: string, isShiftEnabled: boolean) => {
    if (!isShiftEnabled) {
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

  // --- ฟังก์ชันคำนวณระยะทางพิกัด (Haversine Formula) ---
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3 // รัศมีโลก (เมตร)
    const p1 = lat1 * Math.PI/180
    const p2 = lat2 * Math.PI/180
    const dp = (lat2-lat1) * Math.PI/180
    const dl = (lon2-lon1) * Math.PI/180
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // คืนค่าเป็นเมตร
  }

  // --- ฟังก์ชันจัดการอัปโหลดภาพ ---
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  // --- ฟังก์ชันหลักสำหรับลงเวลา เข้า/ออก ---
  const handleAttendance = async (type: 'in' | 'out') => {
    if (!user || !companySettings) return

    // 1. ตรวจสอบเงื่อนไขรูปถ่าย
    if (companySettings.require_photo && !photoFile) {
      alert('📸 กรุณาถ่ายรูปเซลฟี่เพื่อยืนยันตัวตนก่อนลงเวลา')
      return
    }

    setSubmitting(true)
    let currentLat = null
    let currentLng = null
    let imageUrl = null

    try {
      // 1. ดึงพิกัด GPS ของมือถือพนักงานเสมอ (บังคับดึงทุกครั้งที่กดเข้า-ออกงาน)
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        })
        currentLat = position.coords.latitude
        currentLng = position.coords.longitude
      } catch (gpsError) {
        alert('📍 ไม่สามารถระบุพิกัดได้ กรุณาเปิด GPS และอนุญาตให้ LINE เข้าถึงตำแหน่งก่อนทำรายการ')
        setSubmitting(false)
        return
      }

      // 2. เช็กพิกัดออฟฟิศ (ยกเว้นพนักงานที่ได้สิทธิ์ลงเวลานอกสถานที่)
      if (companySettings.location_lat && companySettings.location_lng && !user.allow_remote_attendance) {
        const distance = calculateDistance(
          companySettings.location_lat, 
          companySettings.location_lng, 
          currentLat, 
          currentLng
        )
        
        if (distance > (companySettings.location_radius || 100)) {
          alert(`📍 คุณอยู่นอกพื้นที่ทำงาน\n(ห่าง ${Math.round(distance)} เมตร / อนุญาตให้ห่างได้ไม่เกิน ${companySettings.location_radius} เมตร)`)
          setSubmitting(false)
          return
        }
      }

      // 3. อัปโหลดรูปภาพ (ถ้ามี)
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${user.id}_${Date.now()}_${type}.${fileExt}`
        const { error: uploadErr } = await supabase.storage.from('attendance').upload(fileName, photoFile)
        
        if (uploadErr) {
          alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + uploadErr.message)
          setSubmitting(false)
          return
        }
        
        const { data: publicUrlData } = supabase.storage.from('attendance').getPublicUrl(fileName)
        imageUrl = publicUrlData.publicUrl
      }

      // 4. บันทึกลงฐานข้อมูล
      const now = new Date()
      
      if (type === 'in') {
        const todayDate = now.toISOString().split('T')[0]
        const payload: any = {
          user_id: user.id,
          action_date: todayDate,
          check_in_time: now.toISOString(),
          check_in_lat: currentLat,
          check_in_lng: currentLng,
          check_in_image: imageUrl
        }
        if (companySettings.has_shifts && selectedShiftId) payload.shift_id = selectedShiftId

        const { error } = await supabase.from('attendance').insert([payload])
        if (error) throw error
        alert('🟢 ลงเวลาเข้างานเรียบร้อยแล้ว!')

      } else {
        let query = supabase.from('attendance').update({ 
          check_out_time: now.toISOString(),
          check_out_lat: currentLat,
          check_out_lng: currentLng,
          check_out_image: imageUrl
        })

        if (activeRecord?.id) {
          query = query.eq('id', activeRecord.id)
        } else {
          query = query.eq('user_id', user.id).is('check_out_time', null)
        }

        const { error } = await query
        if (error) throw error
        alert('🔴 ลงเวลาออกงานเรียบร้อยแล้ว!')
      }

      // 5. รีเซ็ตฟอร์มและอัปเดตสถานะ
      setPhotoFile(null)
      setPhotoPreview(null)
      await checkAttendanceStatus(user.id, companySettings.has_shifts)

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
      <div>
        <div className="bg-indigo-600 text-white rounded-3xl p-6 shadow-lg mb-6 relative">
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <div className="absolute top-4 right-4 bg-white/20 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase">
              {user.role}
            </div>
          )}
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

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">โหมดลงเวลา</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              companySettings?.has_shifts ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {companySettings?.has_shifts ? '🏭 ระบบมีกะการทำงาน' : '🏢 เวลาฟิกซ์มาตรฐาน'}
            </span>
          </div>

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
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
              <span className="text-xs text-slate-500 font-bold">✅ ลงเวลาเข้า-ออกงาน ครบถ้วนแล้ววันนี้</span>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <span className="text-xs text-amber-700 font-bold">⏰ ยังไม่ได้ลงเวลาเข้างาน</span>
            </div>
          )}

          {companySettings?.has_shifts && !activeRecord && (
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

        {/* --- ส่วนฟอร์มถ่ายรูป --- */}
        {companySettings?.require_photo && !isCompletedToday && (
          <div className="mt-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
            <h3 className="text-sm font-bold text-slate-800 mb-3">📸 ถ่ายรูปยืนยันตัวตน</h3>
            {photoPreview ? (
              <div className="relative w-full h-48 mb-3 rounded-xl overflow-hidden border-2 border-indigo-200">
                <img src={photoPreview} alt="Selfie Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 bg-rose-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-md"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <span className="text-3xl mb-2">🤳</span>
                  <p className="text-xs font-bold text-slate-500">แตะเพื่อเปิดกล้องหน้า</p>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="user" 
                  onChange={handlePhotoChange} 
                  className="hidden" 
                />
              </label>
            )}
            <p className="text-[10px] text-slate-400 mt-2">* ระบบจะตรวจสอบพิกัด GPS อัตโนมัติเมื่อกดลงเวลา</p>
          </div>
        )}

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
          <Link className="col-span-2 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-800 font-bold text-sm shadow-sm hover:bg-indigo-100 flex items-center justify-center gap-3 transition-colors" href="/liff/payslip">
            <span className="text-2xl">🧾</span>
            <span>ดูสลิปเงินเดือนของฉัน</span>
          </Link>
        </div>
        
        {(user?.role === 'manager' || user?.role === 'admin') && (
           <div className="mt-3">
             <Link href="/liff/approvals" className="w-full bg-slate-800 text-white rounded-2xl p-4 flex items-center justify-between hover:bg-slate-700 transition shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📥</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">ตรวจสอบคำขอ (รออนุมัติ)</span>
                    <span className="text-[10px] text-slate-300">จัดการใบลาและโอทีของลูกทีม</span>
                  </div>
                </div>
                {pendingApprovalsCount > 0 ? (
                  <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse shadow-md">
                    {pendingApprovalsCount} รายการ
                  </span>
                ) : (
                  <span className="text-slate-400 text-xl">›</span>
                )}
             </Link>
           </div>
        )}

      </div>

      <div className="mt-8">
        {activeRecord ? (
          <button
            onClick={() => handleAttendance('out')}
            disabled={submitting}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-2xl text-lg shadow-lg shadow-rose-200 transition-all disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึกข้อมูล...' : '🔴 ลงเวลาออกงาน'}
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
            onClick={() => handleAttendance('in')}
            disabled={submitting || (companySettings?.has_shifts && !selectedShiftId)}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-lg shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึกข้อมูล...' : '🟢 ลงเวลาเข้างาน'}
          </button>
        )}
      </div>
    </div>
  )
}