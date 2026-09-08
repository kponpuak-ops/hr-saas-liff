'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function OTAdminPage() {
  const [otRequests, setOtRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOT, setSelectedOT] = useState<any>(null)

  useEffect(() => {
    fetchOTRequests()
  }, [])

  const fetchOTRequests = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('ot_requests')
      .select(`
        *,
        users (*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching OT requests:', error)
    } else {
      setOtRequests(data || [])
    }
    setIsLoading(false)
  }

  const handleUpdateStatus = async (otId: number, status: 'approved' | 'rejected') => {
    if (!confirm(`คุณต้องการ ${status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'} รายการ OT นี้ใช่หรือไม่?`)) return;

    const { error } = await supabase
      .from('ot_requests')
      .update({ status })
      .eq('id', otId)

    if (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ')
    } else {
      if (selectedOT?.id === otId) {
        setSelectedOT({ ...selectedOT, status })
      }
      fetchOTRequests()
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

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-'
    return timeStr.substring(0, 5) // แปลง 17:00:00 เป็น 17:00
  }

  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return 0
    const [h1, m1] = start.split(':').map(Number)
    const [h2, m2] = end.split(':').map(Number)
    let diff = (h2 + m2 / 60) - (h1 + m1 / 60)
    if (diff < 0) diff += 24 // กรณีข้ามคืน เช่น 22:00 ถึง 02:00
    return diff.toFixed(1)
  }

  const filteredRequests = otRequests.filter((req) => {
    const fullName = `${req.users?.first_name || ''} ${req.users?.last_name || ''}`.toLowerCase()
    const matchesSearch = fullName.includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">จัดการคำขอทำล่วงเวลา (OT Requests)</h1>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {filteredRequests.length === 0 ? (
          <p className="text-slate-500 text-center py-8">ไม่พบรายการยื่นขอ OT ที่ตรงกับเงื่อนไข</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                  <th className="pb-3">ชื่อ-นามสกุล</th>
                  <th className="pb-3 text-center">วันที่ขอทำ OT</th>
                  <th className="pb-3 text-center">ช่วงเวลา</th>
                  <th className="pb-3 text-center">รวมเวลา</th>
                  <th className="pb-3 text-center">สถานะ</th>
                  <th className="pb-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-medium text-slate-800">
                      {item.users?.first_name} {item.users?.last_name}
                      <div className="text-xs text-slate-500 font-normal mt-0.5">
                        {item.users?.position || item.users?.role || '-'}
                      </div>
                    </td>
                    <td className="py-4 text-sm font-bold text-slate-700 text-center">
                      {formatDate(item.request_date)}
                    </td>
                    <td className="py-4 text-sm font-bold text-indigo-600 text-center">
                      {formatTime(item.start_time)} - {formatTime(item.end_time)} น.
                    </td>
                    <td className="py-4 text-center">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md">
                        {calculateHours(item.start_time, item.end_time)} ชม.
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {item.status === 'pending' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ รออนุมัติ</span>}
                      {item.status === 'approved' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">✅ อนุมัติแล้ว</span>}
                      {item.status === 'rejected' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">❌ ไม่อนุมัติ</span>}
                    </td>
                    <td className="py-4 text-center">
                      <button
                        onClick={() => setSelectedOT(item)}
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

      {/* Modal ดูรายละเอียด OT */}
      {selectedOT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">รายละเอียดการขอ OT</h2>
              <button onClick={() => setSelectedOT(null)} className="text-slate-400 hover:text-slate-700 transition font-bold">✕ ปิด</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl overflow-hidden border border-slate-200">
                  {selectedOT.users?.avatar_url ? (
                    <img src={selectedOT.users?.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    selectedOT.users?.first_name?.[0]
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{selectedOT.users?.first_name} {selectedOT.users?.last_name}</h3>
                  <p className="text-xs text-slate-500">{selectedOT.users?.position || selectedOT.users?.role || '-'}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400">วันที่ขอทำ OT</span>
                    <p className="text-sm font-bold text-slate-800">{formatDate(selectedOT.request_date)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400">เวลา (เริ่มต้น - สิ้นสุด)</span>
                    <p className="text-sm font-bold text-indigo-600">
                      {formatTime(selectedOT.start_time)} - {formatTime(selectedOT.end_time)} น.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">จำนวนชั่วโมงที่ขอ:</span>
                  <div className="text-sm font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg">
                    {calculateHours(selectedOT.start_time, selectedOT.end_time)} ชั่วโมง
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400">เหตุผล / รายละเอียดงาน</span>
                <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 min-h-[60px] border border-slate-100">
                  {selectedOT.reason || 'ไม่ระบุเหตุผล'}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              {selectedOT.status === 'pending' ? (
                <>
                  <button
                    onClick={() => handleUpdateStatus(selectedOT.id, 'rejected')}
                    className="px-4 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-bold transition-colors"
                  >
                    ❌ ไม่อนุมัติ
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedOT.id, 'approved')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                  >
                    ✅ อนุมัติ OT
                  </button>
                </>
              ) : (
                <div className="w-full text-center">
                  <span className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${
                    selectedOT.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    ทำรายการเรียบร้อยแล้ว ({selectedOT.status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'})
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