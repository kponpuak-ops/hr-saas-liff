'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'

export default function ManagerApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'leave' | 'ot'>('leave')
  const [managerInfo, setManagerInfo] = useState<any>(null)
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([])
  const [pendingOTs, setPendingOTs] = useState<any[]>([])
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

        if (userData && (userData.role === 'manager' || userData.role === 'admin')) {
          setManagerInfo(userData)
          fetchPendingRequests(userData.company_id, userData.department, userData.role)
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

  const fetchPendingRequests = async (companyId: number, department: string, role: string) => {
    // 1. ดึงคำขอลา (Leaves)
    let leaveQuery = supabase
      .from('leaves')
      .select(`*, users!inner(first_name, last_name, department, role, company_id)`)
      .eq('status', 'pending')
      .eq('users.company_id', companyId)
      .order('created_at', { ascending: false })

    // 2. ดึงคำขอ OT (สมมติชื่อตารางว่า ot_requests - ปรับแก้ได้ตามฐานข้อมูลจริง)
    let otQuery = supabase
      .from('ot_requests')
      .select(`*, users!inner(first_name, last_name, department, role, company_id)`)
      .eq('status', 'pending')
      .eq('users.company_id', companyId)
      .order('created_at', { ascending: false })

    if (role === 'manager') {
      leaveQuery = leaveQuery.eq('users.department', department).eq('users.role', 'staff')
      otQuery = otQuery.eq('users.department', department).eq('users.role', 'staff')
    }

    const [leaveRes, otRes] = await Promise.all([leaveQuery, otQuery])
    
    if (leaveRes.data) setPendingLeaves(leaveRes.data)
    if (otRes.data) setPendingOTs(otRes.data)
    
    setIsLoading(false)
  }

  const handleApproval = async (type: 'leave' | 'ot', id: number, action: 'approve' | 'reject') => {
    if (!confirm(`ยืนยันการ ${action === 'approve' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'} คำขอนี้?`)) return
    
    setIsProcessing(id)
    
    // ตั้งค่าสถานะ: ถ้าอนุมัติให้เป็น manager_approved เพื่อส่งต่อให้ HR
    const newStatus = action === 'approve' ? 'manager_approved' : 'rejected'
    const table = type === 'leave' ? 'leaves' : 'ot_requests'
    const apiEndpoint = type === 'leave' ? '/api/notify-leave' : '/api/notify-ot'

    const { error } = await supabase
      .from(table)
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      }).catch(err => console.error('Notify Error:', err))

      if (type === 'leave') {
        setPendingLeaves(prev => prev.filter(item => item.id !== id))
      } else {
        setPendingOTs(prev => prev.filter(item => item.id !== id))
      }
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
    setIsProcessing(null)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  }

  if (isLoading) return <div className="p-6 text-center text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูล...</div>

  if (!managerInfo) {
    return (
      <div className="p-6 text-center text-rose-500 font-bold bg-rose-50 h-screen flex flex-col justify-center">
        <span className="text-4xl mb-2 block">🔒</span>คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">📋 รออนุมัติ</h1>
          <p className="text-xs text-slate-500 font-medium">แผนก: {managerInfo.department}</p>
        </div>
        <button onClick={() => window.location.href = '/liff'} className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          ✕ ปิด
        </button>
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-xl mb-4">
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'leave' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          📝 ใบลา ({pendingLeaves.length})
        </button>
        <button
          onClick={() => setActiveTab('ot')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'ot' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          💰 ขอ OT ({pendingOTs.length})
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'leave' && (
          pendingLeaves.length === 0 ? (
            <p className="text-center text-slate-400 py-8 font-medium">ไม่มีใบลาที่รออนุมัติ</p>
          ) : (
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
                {leave.attachment_url && <a href={leave.attachment_url} target="_blank" rel="noreferrer" className="block text-center text-xs font-bold text-indigo-600 bg-indigo-50 py-2 rounded-xl mb-4">📎 ดูไฟล์แนบ</a>}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <button onClick={() => handleApproval('leave', leave.id, 'reject')} disabled={isProcessing === leave.id} className="py-2.5 rounded-xl text-sm font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">❌ ไม่อนุมัติ</button>
                  <button onClick={() => handleApproval('leave', leave.id, 'approve')} disabled={isProcessing === leave.id} className="py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white shadow-sm">✅ อนุมัติให้ HR</button>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'ot' && (
          pendingOTs.length === 0 ? (
            <p className="text-center text-slate-400 py-8 font-medium">ไม่มีคำขอ OT ที่รออนุมัติ</p>
          ) : (
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
                      {formatDate(ot.ot_date)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-3">
                  <span className="bg-slate-100 px-2 py-1 rounded">🕒 {ot.start_time?.substring(0,5)} - {ot.end_time?.substring(0,5)} น.</span>
                </div>
                {ot.reason && <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 mb-3 border border-slate-100"><span className="font-bold text-slate-400">เหตุผล: </span>{ot.reason}</div>}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <button onClick={() => handleApproval('ot', ot.id, 'reject')} disabled={isProcessing === ot.id} className="py-2.5 rounded-xl text-sm font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">❌ ไม่อนุมัติ</button>
                  <button onClick={() => handleApproval('ot', ot.id, 'approve')} disabled={isProcessing === ot.id} className="py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white shadow-sm">✅ อนุมัติให้ HR</button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}