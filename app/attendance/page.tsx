'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AttendanceAdminPage() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single()
      
      setSettings(companySettings)

      // 👈 แก้ไขจุดนี้: เอา employee_id ออกจาก users (...)
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select(`
          *,
          users (first_name, last_name, avatar_url, position),
          work_shifts (shift_name, start_time, end_time)
        `)
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

  // ฟังก์ชันคำนวณมาสายและยอดหักเงิน
  const calculateLate = (checkInTime: string, shiftInfo: any) => {
    if (!checkInTime || !settings) return { lateMinutes: 0, penalty: 0 }

    // 1. ดึงเวลาเริ่มงาน, บัฟเฟอร์สาย, และอัตราหักเงิน (รองรับทั้งแบบมีกะ และเวลามาตรฐาน)
    const expectedStartTime = shiftInfo?.start_time || settings.default_start_time
    const buffer = shiftInfo?.late_buffer_minutes ?? settings.late_buffer_minutes ?? 0
    const penaltyRate = shiftInfo?.late_deduction_per_minute ?? settings.late_deduction_per_minute ?? 0

    if (!expectedStartTime) return { lateMinutes: 0, penalty: 0 }

    const checkInDate = new Date(checkInTime)
    
    // แปลงเวลาเป้าหมาย (HH:mm) มาสร้างเป็น Date object ในวันและเวลาเป้าหมาย
    const [expHours, expMinutes] = expectedStartTime.split(':').map(Number)
    const expectedDate = new Date(checkInTime)
    expectedDate.setHours(expHours, expMinutes, 0, 0)

    // คำนวณส่วนต่างเป็นนาที
    const diffMs = checkInDate.getTime() - expectedDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    // ถ้าสายเกินกว่าจำนวนนาทีที่ยืดหยุ่นได้ (Buffer)
    if (diffMins > buffer) {
      const penalty = diffMins * penaltyRate
      return { lateMinutes: diffMins, penalty }
    }

    return { lateMinutes: 0, penalty: 0 }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ประวัติการลงเวลา (Attendance)</h1>
            <p className="text-slate-500 mt-1">
              {settings?.has_shifts ? '🏢 โหมดปัจจุบัน: ระบบมีกะ (Multi-Shift)' : '🏢 โหมดปัจจุบัน: เวลามาตรฐาน (Fixed Time)'}
            </p>
          </div>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow font-medium transition"
          >
            🔄 รีเฟรชข้อมูล
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">วันที่</th>
                  <th className="px-6 py-4 font-semibold">พนักงาน</th>
                  <th className="px-6 py-4 font-semibold">รอบกะการทำงาน</th>
                  <th className="px-6 py-4 font-semibold text-center">เข้างาน</th>
                  <th className="px-6 py-4 font-semibold text-center">ออกงาน</th>
                  <th className="px-6 py-4 font-semibold text-right">สถานะสาย / หักเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      ยังไม่มีประวัติการลงเวลา
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    // คำนวณความสาย
                    const lateInfo = calculateLate(record.check_in_time, record.work_shifts)
                    const isLate = lateInfo.lateMinutes > 0

                    return (
                      <tr key={record.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          {new Date(record.action_date).toLocaleDateString('th-TH', { 
                            year: 'numeric', month: 'short', day: 'numeric' 
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                              {record.users?.first_name?.[0] || '👤'}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">
                                {record.users?.first_name} {record.users?.last_name}
                              </p>
                              <p className="text-xs text-slate-500">{record.users?.position || 'พนักงาน'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {record.work_shifts ? (
                            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-xs font-medium inline-block">
                              {record.work_shifts.shift_name} ({record.work_shifts.start_time?.substring(0,5)} - {record.work_shifts.end_time?.substring(0,5)})
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-medium inline-block">
                              เวลามาตรฐาน
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded">
                            {record.check_in_time 
                              ? new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
                              : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {record.check_out_time ? (
                            <span className="text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded">
                              {new Date(record.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-amber-500 text-xs font-semibold bg-amber-50 px-2 py-1 rounded">
                              กำลังปฏิบัติงาน
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isLate ? (
                            <div className="flex flex-col items-end">
                              <span className="text-rose-600 text-xs font-bold">สาย {lateInfo.lateMinutes} นาที</span>
                              <span className="text-rose-800 font-semibold mt-0.5">-{lateInfo.penalty} ฿</span>
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
    </div>
  )
}