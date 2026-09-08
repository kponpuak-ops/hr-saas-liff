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

  // 2. ดึงการตั้งค่าเวลาทำงานจากตาราง company_settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('default_start_time, late_buffer_minutes, late_deduction_per_minute')
    .eq('id', 1)
    .single()

  // ค่าตั้งต้นเวลาทำงาน
  const defaultStartTime = settings?.default_start_time || '08:30:00'
  const lateBufferMinutes = settings?.late_buffer_minutes || 0
  const deductionPerMinute = settings?.late_deduction_per_minute || 0

  if (error) return <div className="p-4 text-red-500">เกิดข้อผิดพลาด: {error.message}</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ประวัติการลงเวลา (Attendance)</h1>
          <p className="text-slate-500 text-sm">
            เวลาเข้างานมาตรฐาน: {defaultStartTime.substring(0, 5)} น. (สายได้ไม่เกิน {lateBufferMinutes} นาที | หักนาทีละ ฿{deductionPerMinute})
          </p>
        </div>
        {records && records.length > 0 && <ExportButton data={records} />}
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        {!records || records.length === 0 ? (
          <p className="text-slate-500 text-center py-4">ยังไม่มีข้อมูลการลงเวลา</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="pb-3">วันที่</th>
                  <th className="pb-3">ชื่อ-นามสกุล</th>
                  <th className="pb-3">ตำแหน่ง</th>
                  <th className="pb-3">เวลาเข้างาน</th>
                  <th className="pb-3">เวลาออกงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
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

                  // 3. ฟังก์ชันคำนวณจำนวนนาทีที่สาย และยอดเงินหัก
                  const getLateDetails = (timeString: string | null) => {
                    if (!timeString) return { isLate: false, lateMins: 0, penalty: 0 }
                    
                    const date = new Date(timeString)
                    const thaiTimeStr = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false })
                    const [inHour, inMinute] = thaiTimeStr.split(':').map(Number)
                    const [stdHour, stdMinute] = defaultStartTime.split(':').map(Number)

                    const checkInTotalMins = inHour * 60 + inMinute
                    const stdTotalMins = stdHour * 60 + stdMinute
                    const allowedCutoffMins = stdTotalMins + lateBufferMinutes

                    // หากเวลาเข้างาน เกินเวลามาตรฐาน + นาทีที่อนุญาต (Buffer)
                    if (checkInTotalMins > allowedCutoffMins) {
                      const lateMins = checkInTotalMins - stdTotalMins // คำนวณนาทีสายจากเวลาเข้างานปกติ
                      const penalty = lateMins * deductionPerMinute
                      return { isLate: true, lateMins, penalty }
                    }

                    return { isLate: false, lateMins: 0, penalty: 0 }
                  }

                  const lateInfo = getLateDetails(record.check_in_time)

                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-medium text-slate-600">{formatDate(record.action_date)}</td>
                      <td className="py-4 font-bold text-slate-800">
                        {record.users?.first_name} {record.users?.last_name}
                      </td>
                      <td className="py-4 text-slate-500">{record.users?.role || '-'}</td>
                      
                      <td className="py-4">
                        <span className="text-emerald-600 font-bold">{formatTime(record.check_in_time)}</span>
                        {lateInfo.isLate && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            🔴 สาย {lateInfo.lateMins} นาที {lateInfo.penalty > 0 ? `(หัก ฿${lateInfo.penalty.toLocaleString()})` : ''}
                          </span>
                        )}
                      </td>

                      <td className="py-4 text-slate-600 font-medium">{formatTime(record.check_out_time)}</td>
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