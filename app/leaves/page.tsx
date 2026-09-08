'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LeavesAdminPage() {
  const [leaves, setLeaves] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLeaves()
  }, [])

  const fetchLeaves = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('leaves')
      .select(`
        *,
        users (
          first_name,
          last_name,
          role
        )
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
    const { error } = await supabase
      .from('leaves')
      .update({ status })
      .eq('id', leaveId)

    if (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ')
    } else {
      // สั่งส่งข้อความแจ้งเตือนหาพนักงานทาง LINE
      fetch('/api/notify-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId, status }),
      }).catch((err) => console.error('Notification error:', err))

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

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">จัดการรายการลา (Leave Requests)</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {leaves.length === 0 ? (
          <p className="text-slate-500 text-center py-4">ยังไม่มีรายการยื่นใบลาในระบบ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                  <th className="pb-3 font-medium">ประเภทการลา</th>
                  <th className="pb-3 font-medium">ช่วงวันที่</th>
                  <th className="pb-3 font-medium">เหตุผล</th>
                  <th className="pb-3 font-medium">สถานะ</th>
                  <th className="pb-3 font-medium text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-medium text-slate-800">
                      {item.users?.first_name} {item.users?.last_name}
                      <div className="text-xs text-slate-400 font-normal">{item.users?.role}</div>
                    </td>
                    <td className="py-4 text-sm font-medium text-indigo-600">{item.leave_type}</td>
                    <td className="py-4 text-sm text-slate-600">
                      {formatDate(item.start_date)} - {formatDate(item.end_date)}
                    </td>
                    <td className="py-4 text-sm text-slate-500 max-w-xs truncate">{item.reason || '-'}</td>
                    <td className="py-4">
                      {item.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          ⏳ รออนุมัติ
                        </span>
                      )}
                      {item.status === 'approved' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          ✅ อนุมัติแล้ว
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          ❌ ไม่อนุมัติ
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {item.status === 'pending' ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'approved')}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            อนุมัติ
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'rejected')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            ไม่อนุมัติ
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}