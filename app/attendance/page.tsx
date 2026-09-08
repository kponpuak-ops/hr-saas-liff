import { supabase } from '../../lib/supabase'
import ExportButton from '../components/ExportButton'

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  // 1. ดึงข้อมูลประวัติการลงเวลา
  const { data: records, error } = await supabase
    .from('attendance')
    .select(`
      *,
      users (
        first_name,
        last_name,
        role
      )
    `)
    .order('action_date', { ascending: false })
    .order('check_in_time', { ascending: false })

  // 2. ดึงเวลาเข้างานมาตรฐานจากตาราง companies
  const { data: company } = await supabase
    .from('companies')
    .select('check_in_time')
    .eq('id', 1)
    .single()

  // กำหนดเวลามาตรฐาน (ถ้าไม่มีข้อมูลให้ใช้ 09:00:00 เป็นค่าสำรอง)
  const standardTime = company?.check_in_time || '09:00:00'
  const [stdHour, stdMinute] = standardTime.split(':').map(Number)

  if (error) return <div className="p-4 text-red-500">เกิดข้อผิดพลาด: {error.message}</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ประวัติการลงเวลา (Attendance)</h1>
        {records && records.length > 0 && <ExportButton data={records} />}
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {!records || records.length === 0 ? (
          <p className="text-slate-500 text-center py-4">ยังไม่มีข้อมูลการลงเวลา</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">วันที่</th>
                  <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                  <th className="pb-3 font-medium">ตำแหน่ง</th>
                  <th className="pb-3 font-medium">เวลาเข้างาน</th>
                  <th className="pb-3 font-medium">เวลาออกงาน</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const formatDate = (dateString: string) => {
                     return new Date(dateString).toLocaleDateString('th-TH', { 
                       timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: 'numeric' 
                     })
                  }
                  const formatTime = (timeString: string | null) => {
                     if (!timeString) return '-'
                     return new Date(timeString).toLocaleTimeString('th-TH', { 
                       timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' 
                     }) + ' น.'
                  }

                  // 3. คำนวณมาสายตามเวลาที่ตั้งไว้ใน Settings
                  const isLate = (timeString: string | null) => {
                    if (!timeString) return false
                    const date = new Date(timeString)
                    const thaiTimeStr = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false })
                    const [hour, minute] = thaiTimeStr.split(':').map(Number)
                    return hour > stdHour || (hour === stdHour && minute > stdMinute)
                  }

                  return (
                    <tr key={record.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="py-4 text-sm text-slate-600">{formatDate(record.action_date)}</td>
                      <td className="py-4 font-medium text-slate-800">
                        {record.users?.first_name} {record.users?.last_name}
                      </td>
                      <td className="py-4 text-sm text-slate-500">{record.users?.role}</td>
                      
                      <td className="py-4">
                        <span className="text-green-600 font-medium">{formatTime(record.check_in_time)}</span>
                        {isLate(record.check_in_time) && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700">
                            มาสาย
                          </span>
                        )}
                      </td>

                      <td className="py-4 text-rose-600 font-medium">{formatTime(record.check_out_time)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}