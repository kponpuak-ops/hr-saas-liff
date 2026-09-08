'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasShifts, setHasShifts] = useState(false)
  
  // ค่ากลางบริษัท
  const [workStartTime, setWorkStartTime] = useState('08:00')
  const [workEndTime, setWorkEndTime] = useState('17:00')
  const [lateBufferMinutes, setLateBufferMinutes] = useState(10)
  const [latePenaltyPerMinute, setLatePenaltyPerMinute] = useState(5)

  // รายการกะ
  const [shifts, setShifts] = useState<any[]>([])

  // ฟอร์มเพิ่มกะใหม่
  const [newShiftName, setNewShiftName] = useState('')
  const [newShiftStart, setNewShiftStart] = useState('08:00')
  const [newShiftEnd, setNewShiftEnd] = useState('17:00')
  const [newShiftBuffer, setNewShiftBuffer] = useState(10)
  const [newShiftPenalty, setNewShiftPenalty] = useState(5) // 👈 ช่องเพิ่มอัตราหักเงินสายของกะ

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (settings) {
        setHasShifts(settings.has_shifts ?? false)
        setWorkStartTime(settings.work_start_time || '08:00')
        setWorkEndTime(settings.work_end_time || '17:00')
        setLateBufferMinutes(settings.late_buffer_minutes ?? 10)
        setLatePenaltyPerMinute(settings.late_penalty_per_minute ?? 5)
      }

      const { data: shiftData } = await supabase
        .from('work_shifts')
        .select('*')
        .order('id', { ascending: true })

      setShifts(shiftData || [])
    } catch (err: any) {
      console.error('Error fetching settings:', err.message)
    } finally {
      setLoading(false)
    }
  }

  // เพิ่มกะใหม่
  const handleAddShift = async () => {
    if (!newShiftName.trim()) {
      alert('กรุณากรอกชื่อกะ')
      return
    }

    try {
      const { data, error } = await supabase
        .from('work_shifts')
        .insert([{
          shift_name: newShiftName,
          start_time: newShiftStart,
          end_time: newShiftEnd,
          late_buffer_minutes: Number(newShiftBuffer),
          late_penalty_per_minute: Number(newShiftPenalty) // 👈 บันทึกอัตราหักเงิน
        }])
        .select()

      if (error) throw error

      setShifts([...shifts, ...data])
      setNewShiftName('')
      alert('เพิ่มกะใหม่เรียบร้อยแล้ว')
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    }
  }

  // ลบกะ
  const handleDeleteShift = async (id: number) => {
    if (!confirm('คุณต้องการลบกะนี้ใช่หรือไม่?')) return
    try {
      const { error } = await supabase.from('work_shifts').delete().eq('id', id)
      if (error) throw error
      setShifts(shifts.filter(s => s.id !== id))
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message)
    }
  }

  // บันทึกการตั้งค่ารูปแบบการเข้างาน
  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const payload: any = {
        has_shifts: hasShifts,
        late_buffer_minutes: Number(lateBufferMinutes),
        late_penalty_per_minute: Number(latePenaltyPerMinute),
      }

      if (!hasShifts) {
        payload.work_start_time = workStartTime
        payload.work_end_time = workEndTime
      }

      const { error } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', 1)

      if (error) throw error
      alert('💾 บันทึกการตั้งค่าเรียบร้อยแล้ว!')
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">กำลังโหลดข้อมูลการตั้งค่า...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">⚙️ ตั้งค่ารูปแบบการเข้างานของบริษัท</h1>

      {/* เลือกโหมด */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label 
          onClick={() => setHasShifts(false)}
          className={`p-5 rounded-2xl border-2 cursor-pointer transition ${
            !hasShifts ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <input type="radio" checked={!hasShifts} onChange={() => setHasShifts(false)} className="w-4 h-4 text-indigo-600" />
            <div>
              <p className="font-bold text-slate-800">ไม่มีกะ (เวลาทำงานเข้า-ออก ฟิกซ์แน่นอน)</p>
              <p className="text-xs text-slate-500 mt-1">พนักงานทุกคนใช้เวลาเข้า-เลิกงานมาตรฐานเดียวกันทั้งบริษัท</p>
            </div>
          </div>
        </label>

        <label 
          onClick={() => setHasShifts(true)}
          className={`p-5 rounded-2xl border-2 cursor-pointer transition ${
            hasShifts ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <input type="radio" checked={hasShifts} onChange={() => setHasShifts(true)} className="w-4 h-4 text-indigo-600" />
            <div>
              <p className="font-bold text-slate-800">มีกะการทำงาน (Multi-Shift)</p>
              <p className="text-xs text-slate-500 mt-1">มีหลายกะเวลา เช่น กะเช้า, กะบ่าย, กะดึก เหมาะกับโรงงานหรือร้านค้า</p>
            </div>
          </div>
        </label>
      </div>

      {/* สับเปลี่ยนตามโหมด */}
      {!hasShifts ? (
        /* โหมดไม่มีกะ */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-700 text-sm">🏢 เวลาทำงานมาตรฐานของบริษัท</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาเริ่มงาน</label>
              <input type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาสิ้นสุดงาน</label>
              <input type="time" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ยืดหยุ่นสายได้ (นาที)</label>
              <input type="number" value={lateBufferMinutes} onChange={(e) => setLateBufferMinutes(Number(e.target.value))} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">หักเงินสาย (บาท/นาที)</label>
              <input type="number" value={latePenaltyPerMinute} onChange={(e) => setLatePenaltyPerMinute(Number(e.target.value))} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
          </div>
        </div>
      ) : (
        /* โหมดมีกะ */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="font-bold text-slate-700 text-sm">➕ เพิ่มกะการทำงานใหม่</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อกะ</label>
              <input type="text" placeholder="เช่น กะเช้า / กะดึก" value={newShiftName} onChange={(e) => setNewShiftName(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาเริ่มกะ</label>
              <input type="time" value={newShiftStart} onChange={(e) => setNewShiftStart(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาสิ้นสุดกะ</label>
              <input type="time" value={newShiftEnd} onChange={(e) => setNewShiftEnd(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ยืดหยุ่นสาย (นาที)</label>
              <input type="number" value={newShiftBuffer} onChange={(e) => setNewShiftBuffer(Number(e.target.value))} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">หักเงินสาย (บาท/นาที)</label>
              <input type="number" value={newShiftPenalty} onChange={(e) => setNewShiftPenalty(Number(e.target.value))} className="w-full p-2.5 border rounded-xl text-sm" />
            </div>
          </div>

          <button 
            onClick={handleAddShift} 
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition"
          >
            + เพิ่มกะ
          </button>

          <hr className="border-slate-100 my-4" />

          {/* รายการกะทั้งหมด */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">รายการกะทั้งหมดในระบบ:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {shifts.map((s) => (
                <div key={s.id} className="p-4 border rounded-xl bg-slate-50 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{s.shift_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      เวลา: {s.start_time?.substring(0,5)} - {s.end_time?.substring(0,5)} น. 
                      <span className="text-indigo-600 font-medium ml-1">
                        (สายได้ {s.late_buffer_minutes ?? 0} นาที • หัก {s.late_penalty_per_minute ?? 5} ฿/นาที)
                      </span>
                    </p>
                  </div>
                  <button onClick={() => handleDeleteShift(s.id)} className="text-slate-400 hover:text-rose-600 p-1 transition">
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ปุ่มบันทึกหลัก */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 transition disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่ารูปแบบการเข้างาน'}
        </button>
      </div>
    </div>
  )
}