'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [companyPackage, setCompanyPackage] = useState<string>('free')

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIsLoading(false)
        return
      }

      // 1. หาว่าแอดมินคนที่กำลังดูระบบอยู่ "บริษัทอะไร"
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_id', session.user.id)
        .single()

      if (!userData?.company_id) {
        setIsLoading(false)
        return
      }
      const currentCompanyId = userData.company_id

      // เช็คแพ็กเกจ PRO
      const { data: compData } = await supabase
        .from('companies')
        .select('package_tier')
        .eq('id', currentCompanyId)
        .single()
        
      let currentPackage = 'free'
      if (compData && compData.package_tier) {
        currentPackage = compData.package_tier.replace(/"/g, '').toLowerCase()
        setCompanyPackage(currentPackage)
      }

      if (!['trial', 'pro'].includes(currentPackage)) {
        setIsLoading(false)
        return
      }

      // 2. 💡 ล็อกเป้า: ดึง ID ของพนักงานทุกคนใน "บริษัทของแอดมิน" เพื่อเอาไปเป็นตัวกรอง
      const { data: companyStaff } = await supabase
        .from('users')
        .select('auth_id')
        .eq('company_id', currentCompanyId)

      const staffAuthIds = companyStaff?.map(u => u.auth_id).filter(Boolean) || []

      // ถ้าไม่มีพนักงานเลย ให้ข้ามการดึงประวัติไปเลย
      if (staffAuthIds.length === 0) {
        setLogs([])
        setIsLoading(false)
        return
      }

      // 3. 💡 ดึง Audit Log: สั่งให้แสดงเฉพาะรายการที่ "ผู้กระทำ (changed_by)" อยู่ในรายชื่อพนักงานบริษัทนี้เท่านั้น!
      const { data: logsData, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .in('changed_by', staffAuthIds) // กรองแยกข้อมูลตามบริษัทตรงนี้ครับ
        .order('created_at', { ascending: false })
        .limit(100)

      if (logsError) throw logsError

      if (logsData && logsData.length > 0) {
        // ไปดึงชื่อพนักงานมาแสดงผลประกอบ (ใช้รายชื่อที่ดึงมาแล้วได้เลย ลดภาระฐานข้อมูล)
        const { data: usersData } = await supabase
          .from('users')
          .select('auth_id, first_name, last_name, role')
          .in('auth_id', staffAuthIds)

        const formattedLogs = logsData.map(log => ({
          ...log,
          users: usersData?.find(u => u.auth_id === log.changed_by) || null
        }))
        
        setLogs(formattedLogs)
      } else {
        setLogs([])
      }
    } catch (err) {
      console.error("Audit Log Fetch Error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">สร้างใหม่</span>
      case 'UPDATE': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">แก้ไข</span>
      case 'DELETE': return <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold">ลบข้อมูล</span>
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">{action}</span>
    }
  }

  const getTableNameTH = (tableName: string) => {
    const map: Record<string, string> = {
      users: '👤 ข้อมูลพนักงาน',
      company_settings: '⚙️ ตั้งค่าองค์กร',
      payroll_cycles: '💰 รอบเงินเดือน',
      leaves: '📝 ข้อมูลการลา',
      ot_requests: '⏱️ คำขอ OT',
      company_holidays: '📅 ปฏิทินวันหยุด',
      departments: '🏢 แผนก',
      positions: '💼 ตำแหน่งงาน',
      benefit_master: '🎁 ประเภทสวัสดิการ',
      work_shifts: '⏰ กะการทำงาน',
      leave_types: '📝 ประเภทการลา'
    }
    return map[tableName] || tableName
  }

  const getFieldNameTH = (field: string) => {
    const map: Record<string, string> = {
      base_salary: 'ฐานเงินเดือน',
      daily_rate: 'ค่าจ้างรายวัน',
      late_deduction_per_minute: 'อัตราหักมาสาย (บาท/นาที)',
      late_buffer_minutes: 'อนุญาตให้สายได้ (นาที)',
      first_name: 'ชื่อจริง',
      last_name: 'นามสกุล',
      role: 'สิทธิ์การใช้งาน',
      department: 'แผนก',
      position: 'ตำแหน่ง',
      employment_type: 'ประเภทจ้างงาน',
      payment_method: 'ช่องทางรับเงิน',
      bank_account: 'เลขบัญชี',
      allow_remote_attendance: 'สิทธิ์ลงเวลานอกสถานที่',
      ss_enabled: 'เปิดใช้งานประกันสังคม',
      ss_employee_rate: 'อัตราหักประกันสังคม (%)',
      ot_rate_normal: 'เรท OT วันปกติ',
      name: 'ชื่อรายการ',
      title: 'ชื่อตำแหน่ง',
      shift_name: 'ชื่อกะทำงาน',
      start_date: 'วันที่เริ่มต้น',
      end_date: 'วันที่สิ้นสุด',
      payment_date: 'วันที่จ่ายเงิน',
      benefits: 'สวัสดิการพิเศษ',
      max_paid_days: 'สิทธิ์รับค่าจ้าง (วัน/ปี)',
      allow_probation: 'ทดลองงานลาได้',
      is_paid_for_monthly: 'รายเดือนได้เงิน',
      is_paid_for_daily: 'รายวันได้เงิน',
      holiday_date: 'วันที่หยุด',
      start_time: 'เวลาเริ่มต้น',
      end_time: 'เวลาสิ้นสุด'
    }
    return map[field] || field
  }

  const getTargetName = (log: any) => {
    const data = log.new_data || log.old_data || {}
    
    if (log.table_name === 'users') {
      const fName = data.first_name || ''
      const lName = data.last_name || ''
      if (fName || lName) return (
        <div className="text-xs text-indigo-600 font-bold mt-0.5">
          คุณ{fName} {lName}
        </div>
      )
    }
    
    const itemName = data.name || data.title || data.shift_name || ''
    if (itemName) return <div className="text-xs text-indigo-600 font-bold mt-0.5">รายการ: {itemName}</div>

    return null
  }

  const formatVal = (v: any) => {
    if (v === null || v === undefined || v === '') return 'ว่าง'
    if (typeof v === 'boolean') return v ? 'ใช่ (เปิด)' : 'ไม่ (ปิด)'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  if (isLoading) return <div className="p-6 text-slate-500 font-bold">กำลังโหลดประวัติระบบ...</div>

  // 💡 เช็คสิทธิ์เพื่อล็อคหน้าจอ
  const isPro = ['trial', 'pro'].includes(companyPackage)
  if (!isPro) {
    return (
      <div className="pb-10 p-6 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center max-w-md w-full">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-xl font-bold text-slate-800 mb-3">ฟีเจอร์นี้เฉพาะแพ็กเกจ PRO</h1>
          <p className="text-sm text-slate-500 mb-8">
            การเข้าถึงประวัติระบบ (Audit Log) เพื่อตรวจสอบความเคลื่อนไหวเชิงลึก ป้องกันการทุจริต สงวนสิทธิ์ไว้สำหรับแพ็กเกจ Trial และ PRO เท่านั้น
          </p>
          <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all">
            ติดต่ออัปเกรดแพ็กเกจ 🚀
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-10 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">🕵️ ประวัติการใช้งานระบบ (Audit Log)</h1>
        <p className="text-sm text-slate-500 mt-1">ติดตามการเปลี่ยนแปลงข้อมูลสำคัญระดับฐานข้อมูล (แสดง 100 รายการล่าสุด)</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="p-4 font-bold w-48">วัน-เวลา</th>
              <th className="p-4 font-bold">ผู้กระทำ</th>
              <th className="p-4 font-bold">การกระทำ</th>
              <th className="p-4 font-bold">เป้าหมาย</th>
              <th className="p-4 font-bold">รายละเอียดการเปลี่ยนแปลง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">ยังไม่มีประวัติการแก้ไขข้อมูล</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-600">{formatDate(log.created_at)}</td>
                  <td className="p-4 font-bold text-slate-800">
                    {log.users ? `${log.users.first_name} ${log.users.last_name}` : 'ระบบ (System)'}
                    <div className="text-xs font-normal text-slate-500">{log.users?.role || '-'}</div>
                  </td>
                  <td className="p-4">{getActionBadge(log.action)}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{getTableNameTH(log.table_name)}</div>
                    {getTargetName(log)}
                  </td>
                  
                  <td className="p-4">
                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 overflow-x-auto max-w-xl">
                      <div className="font-mono mb-2 text-[10px] text-slate-400">Ref ID: {log.record_id}</div>
                      
                      {log.action === 'UPDATE' && log.old_data && log.new_data && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1.5">
                          {Object.keys(log.new_data).map(key => {
                            if (['id', 'created_at', 'updated_at', 'auth_id', 'company_id'].includes(key)) return null

                            const oldVal = log.old_data[key]
                            const newVal = log.new_data[key]

                            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                              return (
                                <div key={key} className="grid grid-cols-[160px_1fr] gap-2 items-start text-[11px] bg-white p-2 rounded border border-slate-100 shadow-sm">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-700">{getFieldNameTH(key)}</span>
                                    <span className="text-[9px] text-slate-400">{key}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="line-through text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">{formatVal(oldVal)}</span>
                                    <span className="text-slate-400 text-[10px]">➔</span>
                                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{formatVal(newVal)}</span>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          })}
                        </div>
                      )}

                      {log.action === 'INSERT' && log.new_data && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1.5">
                          <div className="text-emerald-600 font-bold mb-2">บันทึกข้อมูลใหม่ลงระบบ:</div>
                          {Object.keys(log.new_data).map(key => {
                            if (['id', 'created_at', 'updated_at', 'company_id'].includes(key)) return null
                            const val = log.new_data[key]
                            if (val === null || val === '') return null

                            return (
                              <div key={key} className="grid grid-cols-[160px_1fr] gap-2 items-start text-[11px]">
                                <span className="font-semibold text-slate-600">▪ {getFieldNameTH(key)}</span>
                                <span className="text-slate-800 font-medium">{formatVal(val)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      
                      {log.action === 'DELETE' && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <div className="text-rose-600 font-bold">ลบข้อมูลออกจากระบบ</div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}