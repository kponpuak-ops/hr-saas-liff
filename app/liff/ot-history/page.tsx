'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function OTHistoryPage() {
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('line_user_id', profile.userId)
            .single()

          if (userData) {
            fetchOTHistory(userData.id)
          }
        } else {
          liff.login()
        }
      } catch (err) {
        console.error('Init error:', err)
        setIsLoading(false)
      }
    }
    initLiff()
  }, [])

  const fetchOTHistory = async (userId: number) => {
    const { data } = await supabase
      .from('ot_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setHistory(data)
    setIsLoading(false)
  }

  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return 0
    const [h1, m1] = start.split(':').map(Number)
    const [h2, m2] = end.split(':').map(Number)
    let diff = (h2 + m2 / 60) - (h1 + m1 / 60)
    if (diff < 0) diff += 24
    return diff.toFixed(1)
  }

  if (isLoading) return <div className="p-6 text-center text-slate-500 font-medium">กำลังโหลด...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-8">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            ⏳ ประวัติการขอ OT
          </h1>
          <Link href="/liff" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
            กลับหน้าหลัก
          </Link>
        </div>

        {/* List */}
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-500 text-sm font-medium">
              ยังไม่มีประวัติการขอ OT
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-400 mb-0.5">วันที่ทำ OT</div>
                    <div className="text-sm font-bold text-slate-800">
                      {new Date(item.request_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    {item.status === 'pending' && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700">⏳ รออนุมัติ</span>}
                    {item.status === 'approved' && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700">✅ อนุมัติ</span>}
                    {item.status === 'rejected' && <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700">❌ ไม่อนุมัติ</span>}
                  </div>
                </div>
                
                <div className="flex gap-6 border-t border-slate-50 pt-3">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5">เวลา (เริ่มต้น-สิ้นสุด)</div>
                    <div className="text-sm font-bold text-indigo-600">
                      {item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)} น.
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5">รวมชั่วโมง</div>
                    <div className="text-sm font-bold text-slate-700">
                      {calculateHours(item.start_time, item.end_time)} ชม.
                    </div>
                  </div>
                </div>

                {item.reason && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-500">เหตุผล: </span>{item.reason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}