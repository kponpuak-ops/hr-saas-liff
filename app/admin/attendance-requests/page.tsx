'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminAttendanceRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [search, setSearch] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: user } = await supabase
        .from('users')
        .select('id, company_id, role, department')
        .eq('auth_id', session.user.id)
        .single()

      if (!user?.company_id) return
      setCurrentUser(user)

      const { data, error } = await supabase
        .from('attendance_requests')
        .select(`
          *,
          users!attendance_requests_user_id_fkey (first_name, last_name, employee_id, department),
          manager:users!attendance_requests_manager_id_fkey(first_name, last_name),
          admin:users!attendance_requests_admin_id_fkey(first_name, last_name)
        `)
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error("ดึงข้อมูลไม่สำเร็จ:", error)
        return
      }

      if (data) setRequests(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleManagerApprove = async (id: number, employeeName: string) => {
    if (!confirm(`ยืนยันการอนุมัติเบื้องต้นให้ "${employeeName}" ใช่หรือไม่?\nคำขอนี้จะถูกส่งต่อไปยัง HR เพื่อปรับปรุงเวลาต่อไป`)) return

    const { error } = await supabase
      .from('attendance_requests')
      .update({ status: 'manager_approved', manager_id: currentUser.id })
      .eq('id', id)

    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else {
      alert('✅ หัวหน้าแผนกอนุมัติเรียบร้อยแล้ว')
      fetchRequests()
      fetch('/api/notify-attendance', { method: 'POST', body: JSON.stringify({ id: id, status: 'manager_approved' }) })
    }
  }

  const handleAdminApprove = async (req: any) => {
    if (!confirm(`ยืนยันการอนุมัติขั้นสุดท้ายและปรับปรุงเวลาให้ "${req.users.first_name}" ใช่หรือไม่?\nระบบจะทำการอัปเดตเวลาลงงานให้อัตโนมัติ`)) return

    try {
      const { data: existingAtt } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', req.user_id)
        .eq('action_date', req.request_date)
        .single()

      let updateError;

      // 💡 ฟังก์ชันช่วยแปลง วันที่ + เวลา ให้เป็นรูปแบบ Timestamp ที่ถูกต้อง (Timestamptz)
      const createTimestamp = (dateStr: string, timeStr: string) => {
        // เติมวินาทีเข้าไปถ้ามีแค่ ชม.:นาที เพื่อป้องกัน Error
        const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr
        return `${dateStr}T${time}+07:00` // บวกเขตเวลาไทย +07:00
      }

      if (existingAtt) {
        // กรณีมีข้อมูลลงเวลาเดิมอยู่แล้ว
        const payload: any = { is_manual: true }
        if (req.check_in_time) payload.check_in_time = createTimestamp(req.request_date, req.check_in_time)
        if (req.check_out_time) payload.check_out_time = createTimestamp(req.request_date, req.check_out_time)

        const { error } = await supabase.from('attendance').update(payload).eq('id', existingAtt.id)
        updateError = error
      } else {
        // กรณีสร้างบันทึกใหม่ของวันนั้น
        const payload: any = {
          company_id: req.company_id,
          user_id: req.user_id,
          action_date: req.request_date,
          is_manual: true
        }
        if (req.check_in_time) payload.check_in_time = createTimestamp(req.request_date, req.check_in_time)
        if (req.check_out_time) payload.check_out_time = createTimestamp(req.request_date, req.check_out_time)

        const { error } = await supabase.from('attendance').insert([payload])
        updateError = error
      }

      if (updateError) throw updateError

      await supabase
        .from('attendance_requests')
        .update({ status: 'approved', admin_id: currentUser.id })
        .eq('id', req.id)
        
      alert('✅ อนุมัติและปรับปรุงเวลาทำงานเรียบร้อยแล้ว')
      fetchRequests()
      
      fetch('/api/notify-attendance', { method: 'POST', body: JSON.stringify({ id: req.id, status: 'approved' }) })
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const handleReject = async (id: number) => {
    if (!confirm('ยืนยันการปฏิเสธคำขอนี้ใช่หรือไม่?')) return
    
    let updateData: any = { status: 'rejected' }
    if (currentUser?.role === 'manager') updateData.manager_id = currentUser.id
    if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') updateData.admin_id = currentUser.id

    const { error } = await supabase.from('attendance_requests').update(updateData).eq('id', id)
    
    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else {
      alert('❌ ปฏิเสธคำขอเรียบร้อยแล้ว')
      fetchRequests()
      fetch('/api/notify-attendance', { method: 'POST', body: JSON.stringify({ id: id, status: 'rejected' }) })
    }
  }

  const filteredRequests = requests.filter(req => {
    const fullName = `${req.users?.first_name || ''} ${req.users?.last_name || ''}`.toLowerCase()
    const matchSearch = fullName.includes(search.toLowerCase()) || (req.users?.employee_id || '').toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false

    const isManager = currentUser?.role === 'manager'
    if (isManager && req.users?.department !== currentUser?.department) return false

    if (activeTab === 'pending') {
      if (isManager) return req.status === 'pending'
      return req.status === 'pending' || req.status === 'manager_approved'
    } else {
      return req.status === 'approved' || req.status === 'rejected' || (isManager && req.status === 'manager_approved')
    }
  })

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>

  return (
    <div className="pb-12 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">⏱️ คำขอปรับปรุงเวลาทำงาน</h1>
          <p className="text-slate-500 text-sm mt-1">จัดการคำขอลืมสแกนนิ้ว และแก้ไขเวลาจากพนักงาน</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="w-full md:w-80">
          <input type="text" placeholder="🔍 ค้นหาชื่อพนักงาน หรือ รหัส..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button onClick={() => setActiveTab('pending')} className={`flex-1 md:w-32 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            ⏳ รอตรวจสอบ
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 md:w-32 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            ประวัติทั้งหมด
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto p-4">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3">พนักงาน</th>
                <th className="p-3 text-center">วันที่ขอแก้ไข</th>
                <th className="p-3 text-center">เวลาที่แจ้งปรับปรุง</th>
                <th className="p-3">เหตุผล</th>
                <th className="p-3 text-center">สถานะ</th>
                {activeTab === 'pending' && <th className="p-3 text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">ไม่มีข้อมูลคำขอในหมวดหมู่นี้</td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{req.users?.first_name} {req.users?.last_name}</div>
                      <div className="text-xs text-slate-500">{req.users?.department || '-'} | ID: {req.users?.employee_id || '-'}</div>
                    </td>
                    <td className="p-3 text-center font-semibold text-slate-700">
                      {new Date(req.request_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 text-xs font-bold text-indigo-700">
                        {req.check_in_time ? <span>เข้า: {req.check_in_time.substring(0,5)}</span> : <span className="text-slate-400">เข้า: -</span>}
                        <span className="text-indigo-200">|</span>
                        {req.check_out_time ? <span>ออก: {req.check_out_time.substring(0,5)}</span> : <span className="text-slate-400">ออก: -</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="max-w-[200px] truncate text-slate-600" title={req.reason}>{req.reason}</div>
                    </td>
                    <td className="p-3 text-center">
                      <div>
                        {req.status === 'pending' && <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-xs font-bold">รอหัวหน้าตรวจสอบ</span>}
                        {req.status === 'manager_approved' && <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold">หัวหน้าอนุมัติแล้ว (รอ HR)</span>}
                        {req.status === 'approved' && <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold">อนุมัติแล้ว</span>}
                        {req.status === 'rejected' && <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md text-xs font-bold">ไม่อนุมัติ</span>}
                      </div>
                      
                      {/* 💡 เพิ่มการแสดงป้ายชื่อผู้อนุมัติแบบหน้าจัดการวันลา */}
                      <div className="mt-2.5 flex flex-col items-center gap-1 text-xs">
                        {req.manager_id && (
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            {req.status === 'rejected' && !req.admin_id ? (
                              <span className="text-[10px]">❌</span>
                            ) : (
                              <span className="text-[10px]">✅</span>
                            )}
                            <span className="text-slate-500">หน.: <span className="font-bold text-slate-700">{req.manager?.first_name}</span></span>
                          </div>
                        )}
                        {req.admin_id && (
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            {req.status === 'rejected' ? (
                              <span className="text-[10px]">❌</span>
                            ) : (
                              <span className="text-[10px]">✅</span>
                            )}
                            <span className="text-slate-500">HR: <span className="font-bold text-slate-700">{req.admin?.first_name}</span></span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {activeTab === 'pending' && (
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          {currentUser?.role === 'manager' && req.status === 'pending' && (
                            <button onClick={() => handleManagerApprove(req.id, req.users?.first_name)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">
                              👀 อนุมัติเบื้องต้น
                            </button>
                          )}

                          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                            <button onClick={() => handleAdminApprove(req)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">
                              ✅ อนุมัติ & อัปเดตเวลา
                            </button>
                          )}
                          
                          <button onClick={() => handleReject(req.id)} className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">
                            ❌ ปฏิเสธ
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}