'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('')
  const [checkInTime, setCheckInTime] = useState('09:00')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', 1)
      .single()

    if (data) {
      setCompanyName(data.company_name || '')
      if (data.check_in_time) {
        setCheckInTime(data.check_in_time.slice(0, 5)) // ตัดเอาเฉพาะ HH:mm
      }
    }
    setIsLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('companies')
      .update({
        company_name: companyName,
        check_in_time: checkInTime,
      })
      .eq('id', 1)

    if (error) {
      setMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } else {
      setMessage('บันทึกการตั้งค่าเรียบร้อยแล้ว!')
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">ตั้งค่าองค์กร (Company Settings)</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm text-center font-medium ${message.includes('เกิดข้อผิดพลาด') ? 'bg-rose-50 text-rose-600' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ชื่อบริษัท / องค์กร
            </label>
            <input 
              type="text" 
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              เวลาเข้างานมาตรฐาน (สำหรับคำนวณการมาสาย)
            </label>
            <input 
              type="time" 
              required
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              พนักงานที่กดลงเวลาหลังจากเวลานี้ ระบบจะแสดงสถานะ "มาสาย" ในรายงาน
            </p>
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </form>
      </div>
    </div>
  )
}