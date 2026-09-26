'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'

export default function ManagerApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'leave' | 'ot' | 'time'>('leave')
  const [managerInfo, setManagerInfo] = useState<any>(null)
  const [workflow, setWorkflow] = useState<'admin_only' | 'manager_approval'>('admin_only')
  
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([])
  const [pendingOTs, setPendingOTs] = useState<any[]>([])
  const [pendingTime, setPendingTime] = useState<any[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<number | null>(null)

  useEffect(() => {
    initApp()
  }, [])

  const initApp = async () => {
    try {
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile()
        
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('line_user_id', profile.userId)
          .single()

        if (userData && (userData.role === 'manager' || userData.role === 'admin' || userData.role === 'super_admin')) {
          setManagerInfo(userData)
          
          const { data: settings } = await supabase
            .from('company_settings')
            .select('approval_workflow')
            .eq('company_id', userData.company_id)
            .single()
            
          const currentWorkflow = settings?.approval_workflow || 'admin_only'
          setWorkflow(currentWorkflow)

          fetchPendingRequests(userData.company_id, userData.department, userData.role, currentWorkflow)
        } else {
          setIsLoading(false)
        }
      } else {
        liff.login()
      }
    } catch (error) {
      console.error('LIFF Init Error:', error)
      setIsLoading(false)
    }
  }

  const fetchPendingRequests = async (companyId: number, department: string, role: string, currentWorkflow: string) => {
    const leaveQuery = supabase
      .from('leaves')
      .select(`*, users!user_id!inner(first_name, last_name, department, role, company_id)`) 
      .eq('users.company_id', companyId)
      .in('status', ['pending', 'manager_approved'])
      .order('created_at', { ascending: false })

    const otQuery = supabase
      .from('ot_requests')
      .select(`*, users!user_id!inner(first_name, last_name, department, role, company_id)`) 
      .eq('users.company_id', companyId)
      .in('status', ['pending', 'manager_approved'])
      .order('created_at', { ascending: false })

    const timeQuery = supabase
      .from('attendance_requests')
      .select(`*, users!attendance_requests_user_id_fkey!inner(first_name, last_name, department, role, company_id)`) 
      .eq('company_id', companyId)
      .in('status', ['pending', 'manager_approved'])
      .order('created_at', { ascending: false })

    const [leaveRes, otRes, timeRes] = await Promise.all([leaveQuery, otQuery, timeQuery])

    let finalLeaves = leaveRes.data || []
    let finalOts = otRes.data || []
    let finalTime = timeRes.data || []

    if (role === 'manager') {
      finalLeaves = finalLeaves.filter((item: any) => item.status === 'pending' && item.users?.department === department && item.users?.role === 'staff')
      finalOts = finalOts.filter((item: any) => item.status === 'pending' && item.users?.department === department && item.users?.role === 'staff')
      finalTime = finalTime.filter((item: any) => item.status === 'pending' && item.users?.department === department && item.users?.role === 'staff')
    } else if (role === 'admin' || role === 'super_admin') {
      if (currentWorkflow === 'manager_approval') {
        finalLeaves = finalLeaves.filter((item: any) => item.status === 'manager_approved' || (item.status === 'pending' && item.users?.role !== 'staff'))
        finalOts = finalOts.filter((item: any) => item.status === 'manager_approved' || (item.status === 'pending' && item.users?.role !== 'staff'))
        finalTime = finalTime.filter((item: any) => item.status === 'manager_approved' || (item.status === 'pending' && item.users?.role !== 'staff'))
      } else {
        finalLeaves = finalLeaves.filter((item: any) => item.status === 'pending')
        finalOts = finalOts.filter((item: any) => item.status === 'pending')
        finalTime = finalTime.filter((item: any) => item.status === 'pending')
      }
    }

    setPendingLeaves(finalLeaves)
    setPendingOTs(finalOts)
    setPendingTime(finalTime)
    setIsLoading(false)
  }

  const handleApproval = async (type: 'leave' | 'ot' | 'time', id: number, action: 'approve' | 'reject', requesterRole: string) => {
    if (!confirm(`ยืนยันการ ${action === 'approve' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'} คำขอนี้?`)) return
    setIsProcessing(id)
    
    let newStatus = action === 'approve' ? 'approved' : 'rejected'
    let updateData: any = { status: newStatus }
    const isAdmin = managerInfo.role === 'admin' || managerInfo.role === 'super_admin'

    if (managerInfo.role === 'manager' && action === 'approve') {
      newStatus = 'manager_approved'
      updateData = { status: newStatus, manager_id: managerInfo.id }
    } else if (isAdmin && action === 'approve') {
      updateData = { status: newStatus, admin_id: managerInfo.id }
    } else if (action === 'reject') {
      if (managerInfo.role === 'manager') updateData.manager_id = managerInfo.id
      if (isAdmin) updateData.admin_id = managerInfo.id
    }

    const table = type === 'leave' ? 'leaves' : type === 'ot' ? 'ot_requests' : 'attendance_requests'
    const apiEndpoint = type === 'leave' ? '/api/notify-leave' : type === 'ot' ? '/api/notify-ot' : '/api/notify-attendance'

    try {
      if (type === 'time' && isAdmin && action === 'approve') {
        const req = pendingTime.find(r => r.id === id)
        
        if (req) {
          // 💡 ดึง Settings เพื่อเตรียมคำนวณหักเงิน
          const { data: settings } = await supabase
            .from('company_settings')
            .select('*')
            .eq('company_id', req.company_id)
            .single()

          const createTimestamp = (dateStr: string, timeStr: string) => {
            const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr
            return `${dateStr}T${time}+07:00`
          }

          const { data: existingAtt, error: fetchErr } = await supabase
            .from('attendance')
            .select('*, work_shifts(start_time, end_time, late_buffer_minutes, late_deduction_per_minute)')
            .eq('user_id', req.user_id)
            .eq('action_date', req.request_date)
            .maybeSingle()

          if (fetchErr) throw new Error('ตรวจสอบข้อมูลเวลาเดิมไม่สำเร็จ: ' + fetchErr.message)

          // 💡 ฟังก์ชันคำนวณหักเงินเหมือนหน้าเว็บเป๊ะ
          const calculateDeduction = (checkInStr: string | null, checkOutStr: string | null, recordInfo: any) => {
            let lateMins = 0;
            let earlyMins = 0;
            let deductAmt = 0;
            
            if (!settings) return { lateMins, earlyMins, deductAmt };

            const useShift = settings.has_shifts && recordInfo?.work_shifts;
            const expectedInTime = useShift ? recordInfo.work_shifts.start_time : settings.default_start_time;
            const expectedOutTime = useShift ? recordInfo.work_shifts.end_time : settings.default_end_time;
            const buffer = useShift ? recordInfo.work_shifts.late_buffer_minutes : (settings.late_buffer_minutes || 0);
            const rate = useShift ? recordInfo.work_shifts.late_deduction_per_minute : (settings.late_deduction_per_minute || 0);

            if (checkInStr) {
               const checkInDateTime = new Date(checkInStr);
               const expectedIn = new Date(`${req.request_date}T${expectedInTime}+07:00`);
               const maxAllowedIn = new Date(expectedIn.getTime() + (buffer * 60000));
               if (checkInDateTime > maxAllowedIn) {
                  lateMins = Math.floor((checkInDateTime.getTime() - expectedIn.getTime()) / 60000);
               }
            }

            if (checkOutStr) {
               const checkOutDateTime = new Date(checkOutStr);
               const expectedOut = new Date(`${req.request_date}T${expectedOutTime}+07:00`);
               if (checkOutDateTime < expectedOut) {
                  earlyMins = Math.floor((expectedOut.getTime() - checkOutDateTime.getTime()) / 60000);
               }
            }

            deductAmt = (lateMins + earlyMins) * rate;
            return { lateMins, earlyMins, deductAmt };
          }

          let dbError;
          let targetAttId = null;

          if (existingAtt) {
            targetAttId = existingAtt.id;
            const payload: any = { is_manual: true }
            if (req.check_in_time) payload.check_in_time = createTimestamp(req.request_date, req.check_in_time)
            if (req.check_out_time) payload.check_out_time = createTimestamp(req.request_date, req.check_out_time)
            
            // นำเวลาใหม่ไปคำนวณหักเงิน
            const targetCheckIn = payload.check_in_time || existingAtt.check_in_time;
            const targetCheckOut = payload.check_out_time || existingAtt.check_out_time;
            const { lateMins, earlyMins, deductAmt } = calculateDeduction(targetCheckIn, targetCheckOut, existingAtt);
            
            payload.late_minutes = lateMins;
            payload.early_leave_minutes = earlyMins;
            payload.deduction_amount = deductAmt;
            
            const { error } = await supabase.from('attendance').update(payload).eq('id', existingAtt.id)
            dbError = error
          } else {
            const payload: any = {
              company_id: req.company_id, 
              user_id: req.user_id, 
              action_date: req.request_date, 
              is_manual: true
            }
            if (req.check_in_time) payload.check_in_time = createTimestamp(req.request_date, req.check_in_time)
            if (req.check_out_time) payload.check_out_time = createTimestamp(req.request_date, req.check_out_time)
            
            // คำนวณหักเงิน
            const { lateMins, earlyMins, deductAmt } = calculateDeduction(payload.check_in_time, payload.check_out_time, null);
            payload.late_minutes = lateMins;
            payload.early_leave_minutes = earlyMins;
            payload.deduction_amount = deductAmt;
            
            const { data: newAtt, error } = await supabase.from('attendance').insert([payload]).select().single()
            dbError = error
            if (newAtt) targetAttId = newAtt.id;
          }

          if (dbError) throw new Error('ปรับปรุงเวลาในฐานข้อมูลไม่สำเร็จ: ' + dbError.message)

          // ประทับตราแอดมินใน Audit Log ที่ Trigger สร้างให้
          if (targetAttId && managerInfo.auth_id) {
            await supabase.from('audit_logs')
              .update({ changed_by: managerInfo.auth_id })
              .eq('table_name', 'attendance')
              .eq('record_id', targetAttId)
              .is('changed_by', null)
          }
        }
      }

      const { error: updateReqErr } = await supabase.from(table).update(updateData).eq('id', id)
      
      if (updateReqErr) throw new Error('อัปเดตสถานะคำขอไม่สำเร็จ: ' + updateReqErr.message)

      fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      }).catch(err => console.error('Notify Error:', err))

      if (type === 'leave') setPendingLeaves(prev => prev.filter(item => item.id !== id))
      else if (type === 'ot') setPendingOTs(prev => prev.filter(item => item.id !== id))
      else setPendingTime(prev => prev.filter(item => item.id !== id))
      
      alert('✅ ดำเนินการและอัปเดตข้อมูลเรียบร้อยแล้ว')

    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  }

  if (isLoading) return <div className="p-6 text-center text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูล...</div>

  if (!managerInfo) return (
    <div className="p-6 text-center text-rose-500 font-bold bg-rose-50 h-screen flex flex-col justify-center">
      <span className="text-4xl mb-2 block">🔒</span>คุณไม่มีสิทธิ์เข้าถึงหน้านี้
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">📋 รออนุมัติ</h1>
          <p className="text-xs text-slate-500 font-medium">{managerInfo.role === 'admin' || managerInfo.role === 'super_admin' ? 'ฝ่ายบุคคล (HR)' : `แผนก: ${managerInfo.department}`}</p>
        </div>
        <button onClick={() => window.location.href = '/liff'} className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          ✕ ปิด
        </button>
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-xl mb-4 overflow-x-auto whitespace-nowrap">
        <button onClick={() => setActiveTab('leave')} className={`flex-1 min-w-[80px] py-2 px-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'leave' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
          📝 ใบลา ({pendingLeaves.length})
        </button>
        <button onClick={() => setActiveTab('ot')} className={`flex-1 min-w-[80px] py-2 px-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ot' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
          💰 ขอ OT ({pendingOTs.length})
        </button>
        <button onClick={() => setActiveTab('time')} className={`flex-1 min-w-[80px] py-2 px-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'time' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
          ⏱️ ปรับเวลา ({pendingTime.length})
        </button>
      </div>

      <div className="space-y-4">
        {/* --- ส่วนของ ใบลา --- */}
        {activeTab === 'leave' && (
          pendingLeaves.length === 0 ? <p className="text-center text-slate-400 py-8 font-medium">ไม่มีใบลาที่รออนุมัติ</p> : (
            pendingLeaves.map(leave => (
              <div key={leave.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{leave.users?.first_name} {leave.users?.last_name}</h3>
                    <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md mt-1">{leave.leave_type}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                      {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                    </div>
                  </div>
                </div>
                {leave.reason && <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 mb-3 border border-slate-100"><span className="font-bold text-slate-400">เหตุผล: </span>{leave.reason}</div>}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <button onClick={() => handleApproval('leave', leave.id, 'reject', leave.users?.role)} disabled={isProcessing === leave.id} className="py-2.5 rounded-xl text-sm font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">❌ ไม่อนุมัติ</button>
                  <button onClick={() => handleApproval('leave', leave.id, 'approve', leave.users?.role)} disabled={isProcessing === leave.id} className="py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white shadow-sm">
                    {managerInfo.role === 'admin' || managerInfo.role === 'super_admin' ? '✅ อนุมัติขั้นสุดท้าย' : '✅ อนุมัติส่งต่อ HR'}
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* --- ส่วนของ ขอ OT --- */}
        {activeTab === 'ot' && (
          pendingOTs.length === 0 ? <p className="text-center text-slate-400 py-8 font-medium">ไม่มีคำขอ OT ที่รออนุมัติ</p> : (
            pendingOTs.map(ot => (
              <div key={ot.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400"></div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{ot.users?.first_name} {ot.users?.last_name}</h3>
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md mt-1">ล่วงเวลา (OT)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                      {formatDate(ot.ot_date || ot.request_date)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-3">
                  <span className="bg-slate-100 px-2 py-1 rounded">🕒 {ot.start_time?.substring(0,5)} - {ot.end_time?.substring(0,5)} น.</span>
                </div>
                {ot.reason && <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 mb-3 border border-slate-100"><span className="font-bold text-slate-400">เหตุผล: </span>{ot.reason}</div>}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <button onClick={() => handleApproval('ot', ot.id, 'reject', ot.users?.role)} disabled={isProcessing === ot.id} className="py-2.5 rounded-xl text-sm font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">❌ ไม่อนุมัติ</button>
                  <button onClick={() => handleApproval('ot', ot.id, 'approve', ot.users?.role)} disabled={isProcessing === ot.id} className="py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white shadow-sm">
                    {managerInfo.role === 'admin' || managerInfo.role === 'super_admin' ? '✅ อนุมัติขั้นสุดท้าย' : '✅ อนุมัติส่งต่อ HR'}
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* --- ส่วนของ ขอปรับเวลาทำงาน --- */}
        {activeTab === 'time' && (
          pendingTime.length === 0 ? <p className="text-center text-slate-400 py-8 font-medium">ไม่มีคำขอปรับเวลาที่รออนุมัติ</p> : (
            pendingTime.map(timeReq => (
              <div key={timeReq.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-400"></div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{timeReq.users?.first_name} {timeReq.users?.last_name}</h3>
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md mt-1">ขอแก้เวลา</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                      {formatDate(timeReq.request_date)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-3">
                  <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    เข้า: <span className="text-indigo-600">{timeReq.check_in_time ? timeReq.check_in_time.substring(0,5) : '-'}</span> | ออก: <span className="text-indigo-600">{timeReq.check_out_time ? timeReq.check_out_time.substring(0,5) : '-'}</span>
                  </span>
                </div>
                {timeReq.reason && <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 mb-3 border border-slate-100"><span className="font-bold text-slate-400">เหตุผล: </span>{timeReq.reason}</div>}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <button onClick={() => handleApproval('time', timeReq.id, 'reject', timeReq.users?.role)} disabled={isProcessing === timeReq.id} className="py-2.5 rounded-xl text-sm font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">❌ ไม่อนุมัติ</button>
                  <button onClick={() => handleApproval('time', timeReq.id, 'approve', timeReq.users?.role)} disabled={isProcessing === timeReq.id} className="py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white shadow-sm">
                    {managerInfo.role === 'admin' || managerInfo.role === 'super_admin' ? '✅ อนุมัติขั้นสุดท้าย' : '✅ อนุมัติส่งต่อ HR'}
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}