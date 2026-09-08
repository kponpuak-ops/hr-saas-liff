'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LeavesAdminPage() {
  const [leaves, setLeaves] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // States สำหรับระบบ Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'pending', 'approved', 'rejected'

  // State สำหรับ Modal ดูรายละเอียด
  const [selectedLeave, setSelectedLeave] = useState<any>(null)

  useEffect(() => {
    fetchLeaves()
  }, [])

  const fetchLeaves = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('leaves')
      .select(`
        *,
        users (*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching leaves:', error)
    } else {
      setLeaves(data || [])
    }
    setIsLoading(false)
  }

  const handleUpdateStatus = async (leaveId: number, status: 'approved' | 'rejected') => {
    if (!confirm(`คุณต้องการ ${status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'} รายการนี้ใช่หรือไม่?`)) return;

    const { error } = await supabase
      .from('leaves')
      .update({ status })
      .eq('id', leaveId)

    if (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ')
    } else {
      // สั่งส่งข้อความแจ้งเตือนหาพนักงานทาง LINE (ถ้ามี API)
      fetch('/api/notify-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId, status }),
      }).catch((err) => console.error('Notification error:', err))

      // ปิด Modal หากกำลังเปิดอยู่
      if (selectedLeave?.id === leaveId) {
        setSelectedLeave({ ...selectedLeave, status })
      }
      
      fetchLeaves()
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // --- Logic กรองข้อมูล ---
  const filteredLeaves = leaves.filter((leave) => {
    const fullName = `${leave.users?.first_name || ''} ${leave.users?.last_name || ''}`.toLowerCase()
    const matchesSearch = fullName.includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || leave.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">จัดการรายการลา (Leave Requests)</h1>
      </div>

      {/* --- ส่วนระบบ Filter --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">ค้นหาชื่อพนักงาน</label>
          <input 
            type="text" 
            placeholder="พิมพ์ชื่อ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="w-48">
          <label className="block text-xs font-bold text-slate-500 mb-1">กรองสถานะ</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">ทั้งหมด</option>
            <option value="pending">⏳ รออนุมัติ</option>
            <option value="approved">✅ อนุมัติแล้ว</option>
            <option value="rejected">❌ ไม่อนุมัติ</option>
          </select>
        </div>
      </div>

      {/* --- ตารางแสดงรายการ --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {filteredLeaves.length === 0 ? (
          <p className="text-slate-500 text-center py-8">ไม่พบรายการยื่นใบลาที่ตรงกับเงื่อนไข</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                  <th className="pb-3 font-medium">ประเภทการลา</th>
                  <th className="pb-3 font-medium">ช่วงวันที่</th>
                  <th className="pb-3 font-medium">สถานะ</th>
                  <th className="pb-3 font-medium text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-medium text-slate-800">
                      {item.users?.first_name} {item.users?.last_name}
                      <div className="text-xs text-slate-500 font-normal mt-0.5">
                        {item.users?.position || item.users?.role || 'ไม่ระบุตำแหน่ง'}
                      </div>
                    </td>
                    <td className="py-4 text-sm font-bold text-indigo-600">{item.leave_type}</td>
                    <td className="py-4 text-sm text-slate-600">
                      {formatDate(item.start_date)} - {formatDate(item.end_date)}
                    </td>
                    <td className="py-4">
                      {item.status === 'pending' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ รออนุมัติ</span>}
                      {item.status === 'approved' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">✅ อนุมัติแล้ว</span>}
                      {item.status === 'rejected' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">❌ ไม่อนุมัติ</span>}
                    </td>
                    <td className="py-4 text-center">
                      <button
                        onClick={() => setSelectedLeave(item)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-300"
                      >
                        🔍 ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Modal ดูรายละเอียดการลา --- */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">รายละเอียดใบลา</h2>
              <button 
                onClick={() => setSelectedLeave(null)}
                className="text-slate-400 hover:text-slate-700 transition font-bold"
              >
                ✕ ปิด
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* ข้อมูลพนักงาน */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xl">
                  {selectedLeave.users?.first_name?.[0]}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{selectedLeave.users?.first_name} {selectedLeave.users?.last_name}</h3>
                  <p className="text-xs text-slate-500">{selectedLeave.users?.position || selectedLeave.users?.role || '-'}</p>
                </div>
              </div>

              {/* รายละเอียดการลา */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400">ประเภท</span>
                  <p className="text-sm font-bold text-indigo-600">{selectedLeave.leave_type}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400">วันที่ลา</span>
                  <p className="text-sm font-bold text-slate-800">
                    {formatDate(selectedLeave.start_date)} - {formatDate(selectedLeave.end_date)}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400">เหตุผล</span>
                <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 min-h-[60px] border border-slate-100">
                  {selectedLeave.reason || 'ไม่ระบุเหตุผล'}
                </div>
              </div>

              {/* หลักฐานแนบ */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400">ไฟล์แนบ / หลักฐาน</span>
                {selectedLeave.attachment_url ? (
                  <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex justify-center">
                    {selectedLeave.attachment_url.toLowerCase().match(/\.(jpeg|jpg|gif|png)$/) != null ? (
                      <a href={selectedLeave.attachment_url} target="_blank" rel="noreferrer">
                        <img src={selectedLeave.attachment_url} alt="หลักฐาน" className="w-auto h-auto max-h-64 object-contain hover:opacity-90 transition cursor-zoom-in" />
                      </a>
                    ) : (
                      <a href={selectedLeave.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-sm text-indigo-600 hover:bg-indigo-50 font-bold w-full justify-center">
                        📎 คลิกเพื่อดูไฟล์แนบ (PDF/Document)
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">ไม่มีไฟล์แนบ</p>
                )}
              </div>
            </div>

            {/* ส่วนปุ่มจัดการ (แสดงเฉพาะสถานะรออนุมัติ) */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              {selectedLeave.status === 'pending' ? (
                <>
                  <button
                    onClick={() => handleUpdateStatus(selectedLeave.id, 'rejected')}
                    className="px-4 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-bold transition-colors"
                  >
                    ❌ ไม่อนุมัติ
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedLeave.id, 'approved')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                  >
                    ✅ อนุมัติใบลา
                  </button>
                </>
              ) : (
                <div className="w-full text-center">
                  <span className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${
                    selectedLeave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    ทำรายการเรียบร้อยแล้ว ({selectedLeave.status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'})
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}