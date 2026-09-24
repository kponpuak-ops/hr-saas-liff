'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [companyPackage, setCompanyPackage] = useState<string>('free')
  
  // State สำหรับระบบค้นหาและตัวกรอง
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTable, setFilterTable] = useState('all')
  const [filterAction, setFilterAction] = useState('all')
  const [recordLimit, setRecordLimit] = useState(100)
  
  // 💡 State ใหม่ สำหรับตัวกรองวันที่
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [recordLimit])

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIsLoading(false)
        return
      }

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

      const { data: companyStaff } = await supabase
        .from('users')
        .select('id, auth_id, first_name, last_name, role')
        .eq('company_id', currentCompanyId)

      setAllUsers(companyStaff || [])
      const staffAuthIds = companyStaff?.map(u => u.auth_id).filter(Boolean) || []

      if (staffAuthIds.length === 0) {
        setLogs([])
        setIsLoading(false)
        return
      }

      const { data: logsData, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .in('changed_by', staffAuthIds)
        .order('created_at', { ascending: false })
        .limit(recordLimit)

      if (logsError) throw logsError

      if (logsData && logsData.length > 0) {
        const formattedLogs = logsData.map(log => ({
          ...log,
          users: companyStaff?.find(u => u.auth_id === log.changed_by) || null
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
      attendance: '📍 ประวัติการลงเวลา' 
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
      default_start_time: 'เวลาเข้างานมาตรฐาน',
      default_end_time: 'เวลาออกงานมาตรฐาน',
      action_date: 'วันที่ปฏิบัติงาน',
      check_in_time: 'เวลาเข้างาน',
      check_out_time: 'เวลาออกงาน',
      late_minutes: 'เข้าสาย (นาที)',
      early_leave_minutes: 'ออกก่อน (นาที)',
      deduction_amount: 'ยอดหักเงิน (บาท)',
      is_manual: 'แก้ไขโดย HR (Manual)',
      user_id: 'รหัสพนักงาน',
      diligence_steps: 'ตั้งค่าเบี้ยขยัน (ขั้นบันได)',
      status: 'สถานะพนักงาน',
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

    if (log.table_name === 'attendance') {
      const actionDate = data.action_date || ''
      const targetUserId = data.user_id
      const targetUser = allUsers.find(u => u.id === targetUserId)

      return (
        <div className="mt-1">
          {targetUser && (
            <div className="text-xs text-indigo-600 font-bold">
              👤 พนักงาน: {targetUser.first_name} {targetUser.last_name}
            </div>
          )}
          {actionDate && (
            <div className="text-xs text-emerald-600 font-bold mt-0.5">
              📅 วันที่: {new Date(actionDate).toLocaleDateString('th-TH')}
            </div>
          )}
        </div>
      )
    }
    
    return null
  }

 const formatVal = (v: any) => {
    if (v === 'active') return '🟢 ทำงานอยู่'
    if (v === 'inactive') return '🔴 พ้นสภาพ/ลาออก'
    if (v === null || v === undefined || v === '') return 'ว่าง'
    if (typeof v === 'boolean') return v ? 'ใช่ (เปิด)' : 'ไม่ (ปิด)'
    
    // 💡 เพิ่มการตรวจสอบ Array สำหรับเบี้ยขยัน เพื่อจัดรูปแบบให้สวยงาม
    if (Array.isArray(v)) {
      return v.map((amt, idx) => `ขั้นที่ ${idx + 1}: ฿${amt}`).join(', ')
    }

    if (typeof v === 'object') return JSON.stringify(v)
    
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
      }
    }
    return String(v)
  }

  // ระบบกรองข้อมูล (Client-side Filtering)
  const filteredLogs = logs.filter(log => {
    // 1. กรองตามตาราง
    if (filterTable !== 'all' && log.table_name !== filterTable) return false;
    
    // 2. กรองตามการกระทำ
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    
    // 3. กรองตามคำค้นหา
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const doerName = log.users ? `${log.users.first_name} ${log.users.last_name}`.toLowerCase() : '';
      const tableNameTh = getTableNameTH(log.table_name).toLowerCase();
      
      let targetName = '';
      const data = log.new_data || log.old_data || {};
      if (log.table_name === 'users') {
        targetName = `${data.first_name || ''} ${data.last_name || ''}`.toLowerCase();
      } else if (log.table_name === 'attendance') {
        const targetUser = allUsers.find(u => u.id === data.user_id);
        if (targetUser) {
          targetName = `${targetUser.first_name} ${targetUser.last_name}`.toLowerCase();
        }
      }

      if (!doerName.includes(query) && !tableNameTh.includes(query) && !targetName.includes(query)) {
        return false;
      }
    }

    // 💡 4. กรองตามวันที่ (เปรียบเทียบจากวันที่สร้าง log)
    if (startDate || endDate) {
      const logDate = new Date(log.created_at);
      logDate.setHours(0, 0, 0, 0); // รีเซ็ตเวลาเป็นเที่ยงคืนเพื่อเทียบแค่วันที่

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (logDate < start) return false;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        if (logDate > end) return false;
      }
    }
    
    return true;
  });

  if (isLoading && logs.length === 0) return <div className="p-6 text-slate-500 font-bold">กำลังโหลดประวัติระบบ...</div>

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
    <div className="pb-10 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🕵️ ประวัติการใช้งานระบบ (Audit Log)</h1>
          <p className="text-sm text-slate-500 mt-1">ติดตามการเปลี่ยนแปลงข้อมูลสำคัญระดับฐานข้อมูล (กำลังแสดงผล {filteredLogs.length} รายการ)</p>
        </div>
        <button 
          onClick={() => {
             setRecordLimit(100);
             setSearchQuery('');
             setFilterAction('all');
             setFilterTable('all');
             // 💡 ล้างค่าวันที่ตอนกดรีเฟรช
             setStartDate('');
             setEndDate('');
             fetchLogs();
          }}
          className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-bold shadow-sm transition-colors"
        >
          🔄 รีเฟรช / ล้างค่า
        </button>
      </div>

      {/* 💡 อัปเดตโครงสร้างกล่องตัวกรอง ให้สวยงามและสมดุลขึ้น */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col gap-4">
        {/* แถวที่ 1: ค้นหา (เต็มความกว้าง) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">🔍 ค้นหา (ชื่อผู้แก้, เป้าหมาย)</label>
          <input 
            type="text" 
            placeholder="พิมพ์เพื่อค้นหา..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
        </div>
        
        {/* แถวที่ 2: ตัวกรอง 4 ช่อง (แบ่งสัดส่วนเท่ากัน) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">หมวดหมู่ข้อมูล</label>
            <select 
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">ทั้งหมด</option>
              <option value="users">👤 ข้อมูลพนักงาน</option>
              <option value="attendance">📍 ประวัติการลงเวลา</option>
              <option value="company_settings">⚙️ ตั้งค่าองค์กร</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">ประเภทการกระทำ</label>
            <select 
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">ทั้งหมด</option>
              <option value="INSERT">สร้างใหม่</option>
              <option value="UPDATE">แก้ไข</option>
              <option value="DELETE">ลบข้อมูล</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">📅 ตั้งแต่วันที่</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">📅 ถึงวันที่</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap md:whitespace-normal">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="p-4 font-bold w-48">วัน-เวลา</th>
                <th className="p-4 font-bold">ผู้กระทำ</th>
                <th className="p-4 font-bold">การกระทำ</th>
                <th className="p-4 font-bold">เป้าหมาย</th>
                <th className="p-4 font-bold min-w-[300px]">รายละเอียดการเปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-400">ไม่พบข้อมูลที่ค้นหา</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-600 align-top">{formatDate(log.created_at)}</td>
                    <td className="p-4 font-bold text-slate-800 align-top">
                      {log.users ? `${log.users.first_name} ${log.users.last_name}` : 'ระบบ (System)'}
                      <div className="text-xs font-normal text-slate-500">{log.users?.role || '-'}</div>
                    </td>
                    <td className="p-4 align-top">{getActionBadge(log.action)}</td>
                    <td className="p-4 align-top">
                      <div className="font-bold text-slate-800">{getTableNameTH(log.table_name)}</div>
                      {getTargetName(log)}
                    </td>
                    
                    <td className="p-4 align-top">
                      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 w-full overflow-hidden">
                        <div className="font-mono mb-2 text-[10px] text-slate-400">Ref ID: {log.record_id}</div>
                        
                        {log.action === 'UPDATE' && log.old_data && log.new_data && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1.5">
                            {Object.keys(log.new_data).map(key => {
                              if (['id', 'created_at', 'updated_at', 'auth_id', 'company_id', 'check_in_lat', 'check_in_lng', 'check_out_lat', 'check_out_lng', 'check_in_image', 'check_out_image'].includes(key)) return null

                              const oldVal = log.old_data[key]
                              const newVal = log.new_data[key]

                              if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                                return (
                                  <div key={key} className="grid grid-cols-[140px_1fr] gap-2 items-start text-[11px] bg-white p-2 rounded border border-slate-100 shadow-sm">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-700">{getFieldNameTH(key)}</span>
                                      <span className="text-[9px] text-slate-400 truncate pr-2">{key}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <span className="line-through text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded break-all">{formatVal(oldVal)}</span>
                                      <span className="text-slate-400 text-[10px]">➔</span>
                                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded break-all">{formatVal(newVal)}</span>
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
                              if (['id', 'created_at', 'updated_at', 'company_id', 'check_in_lat', 'check_in_lng', 'check_out_lat', 'check_out_lng', 'check_in_image', 'check_out_image'].includes(key)) return null
                              const val = log.new_data[key]
                              if (val === null || val === '') return null

                              return (
                                <div key={key} className="grid grid-cols-[140px_1fr] gap-2 items-start text-[11px]">
                                  <span className="font-semibold text-slate-600 truncate pr-2">▪ {getFieldNameTH(key)}</span>
                                  <span className="text-slate-800 font-medium break-all">{formatVal(val)}</span>
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

      {logs.length >= recordLimit && (
        <div className="mt-6 flex justify-center">
          <button 
            onClick={() => setRecordLimit(prev => prev + 100)}
            disabled={isLoading}
            className="px-6 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-full text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? 'กำลังโหลดข้อมูล...' : '🔽 โหลดประวัติเก่าเพิ่มอีก 100 รายการ'}
          </button>
        </div>
      )}
    </div>
  )
}