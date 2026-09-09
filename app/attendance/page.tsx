'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AttendanceAdminPage() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [companyId, setCompanyId] = useState<number | null>(null)

  // สำหรับ Popup ขยายรูป
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. ดึงข้อมูล User ที่ Login เพื่อหา Company ID
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userAuth } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_id', session.user.id)
        .single()

      if (!userAuth?.company_id) return
      setCompanyId(userAuth.company_id)

      // 2. ดึงการตั้งค่าเฉพาะของบริษัทนั้น
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', userAuth.company_id)
        .single()
      
      setSettings(companySettings)

      // 3. ดึงข้อมูลลงเวลา เฉพาะพนักงานในบริษัทเดียวกันเท่านั้น
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select(`
          *,
          users!inner (company_id, first_name, last_name, avatar_url, position),
          work_shifts (shift_name, start_time, end_time)
        `)
        .eq('users.company_id', userAuth.company_id)
        .order('action_date', { ascending: false })
        .order('id', { ascending: false })

      if (error) throw error
      setRecords(attendanceData || [])
    } catch (err: any) {
      console.error('Error fetching data:', err.message)
    } finally {
      setLoading(false)
    }
  }

  // ฟังก์ชันคำนวณระยะทาง
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null
    const R = 6371e3
    const p1 = lat1 * Math.PI/180
    const p2 = lat2 * Math.PI/180
    const dp = (lat2-lat1) * Math.PI/180
    const dl = (lon2-lon1) * Math.PI/180
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return Math.round(R * c)
  }

  // ฟังก์ชันคำนวณมาสาย
  const calculateLate = (checkInTime: string, shiftInfo: any) => {
    if (!checkInTime || !settings) return { lateMinutes: 0, penalty: 0 }

    const expectedStartTime = shiftInfo?.start_time || settings.default_start_time
    const buffer = shiftInfo?.late_buffer_minutes ?? settings.late_buffer_minutes ?? 0
    const penaltyRate = shiftInfo?.late_deduction_per_minute ?? settings.late_deduction_per_minute ?? 0

    if (!expectedStartTime) return { lateMinutes: 0, penalty: 0 }

    const checkInDate = new Date(checkInTime)
    const [expHours, expMinutes] = expectedStartTime.split(':').map(Number)
    const expectedDate = new Date(checkInTime)
    expectedDate.setHours(expHours, expMinutes, 0, 0)

    const diffMs = checkInDate.getTime() - expectedDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins > buffer) {
      const penalty = diffMins * penaltyRate
      return { lateMinutes: diffMins, penalty }
    }

    return { lateMinutes: 0, penalty: 0 }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ประวัติการลงเวลา (Attendance)</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {settings?.has_shifts ? '🏢 โหมด: ระบบมีกะ (Multi-Shift)' : '🏢 โหมด: เวลามาตรฐาน'} 
              {settings?.require_photo && ' • 📸 บังคับถ่ายรูป'}
              {settings?.location_lat && ` • 📍 รัศมี GPS ${settings.location_radius}ม.`}
            </p>
          </div>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow text-sm font-medium transition"
          >
            🔄 รีเฟรชข้อมูล
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-4 font-semibold">วันที่</th>
                  <th className="px-4 py-4 font-semibold">พนักงาน</th>
                  <th className="px-4 py-4 font-semibold text-center">เวลาเข้า / สถานที่</th>
                  <th className="px-4 py-4 font-semibold text-center">เวลาออก / สถานที่</th>
                  <th className="px-4 py-4 font-semibold text-center">รูปถ่ายยืนยัน</th>
                  <th className="px-4 py-4 font-semibold text-right">สาย / หักเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">กำลังโหลดข้อมูล...</td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">ยังไม่มีประวัติการลงเวลา</td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const lateInfo = calculateLate(record.check_in_time, record.work_shifts)
                    const isLate = lateInfo.lateMinutes > 0
                    
                    // คำนวณระยะห่างตอนเข้าและออกงาน
                    const distIn = calculateDistance(settings?.location_lat, settings?.location_lng, record.check_in_lat, record.check_in_lng)
                    const distOut = calculateDistance(settings?.location_lat, settings?.location_lng, record.check_out_lat, record.check_out_lng)

                    return (
                      <tr key={record.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-4">
                          {new Date(record.action_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          {record.work_shifts && (
                             <div className="text-[10px] text-purple-600 font-bold mt-1">กะ: {record.work_shifts.shift_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                              {record.users?.avatar_url ? (
                                <img src={record.users.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                record.users?.first_name?.[0] || '👤'
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{record.users?.first_name} {record.users?.last_name}</p>
                              <p className="text-xs text-slate-500">{record.users?.position || 'พนักงาน'}</p>
                            </div>
                          </div>
                        </td>
                        {/* คอลัมน์เวลาเข้างาน */}
                        <td className="px-4 py-4 text-center">
                          {record.check_in_time ? (
                            <div className="flex flex-col items-center">
                              <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded text-sm">
                                {new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {record.check_in_lat && record.check_in_lng && (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${record.check_in_lat},${record.check_in_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline mt-1 flex items-center gap-1 font-medium transition"
                                >
                                  📍 {distIn !== null ? `ห่าง ${distIn} ม.` : 'ดูพิกัดบนแผนที่'}
                                </a>
                              )}
                            </div>
                          ) : <span className="text-slate-400">-</span>}
                        </td>

                        {/* คอลัมน์เวลาออกงาน */}
                        <td className="px-4 py-4 text-center">
                          {record.check_out_time ? (
                            <div className="flex flex-col items-center">
                              <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded text-sm">
                                {new Date(record.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {record.check_out_lat && record.check_out_lng && (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${record.check_out_lat},${record.check_out_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline mt-1 flex items-center gap-1 font-medium transition"
                                >
                                  📍 {distOut !== null ? `ห่าง ${distOut} ม.` : 'ดูพิกัดบนแผนที่'}
                                </a>
                              )}
                            </div>
                          ) : <span className="text-amber-500 text-xs font-semibold bg-amber-50 px-2 py-1 rounded">กำลังปฏิบัติงาน</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            {record.check_in_image ? (
                              <img src={record.check_in_image} alt="In" onClick={() => setPreviewImage(record.check_in_image)} className="w-10 h-10 rounded border border-slate-200 object-cover cursor-pointer hover:opacity-80 shadow-sm" title="ภาพตอนเข้างาน" />
                            ) : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">IN</div>}
                            
                            {record.check_out_image ? (
                              <img src={record.check_out_image} alt="Out" onClick={() => setPreviewImage(record.check_out_image)} className="w-10 h-10 rounded border border-slate-200 object-cover cursor-pointer hover:opacity-80 shadow-sm" title="ภาพตอนออกงาน" />
                            ) : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">OUT</div>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isLate ? (
                            <div className="flex flex-col items-end">
                              <span className="text-rose-600 text-xs font-bold">สาย {lateInfo.lateMinutes} นาที</span>
                              <span className="text-rose-800 font-bold mt-0.5">-{lateInfo.penalty} ฿</span>
                            </div>
                          ) : (
                            <span className="text-emerald-500 text-xs font-bold">✅ ปกติ</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal สำหรับขยายรูป */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full">
            <button className="absolute -top-10 right-0 text-white font-bold text-xl" onClick={() => setPreviewImage(null)}>✕ ปิด</button>
            <img src={previewImage} alt="Preview" className="w-full h-auto rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  )
}