'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import liff from '@line/liff'

export default function LiffBindPage() {
  const [lineUserId, setLineUserId] = useState<string>('')
  const [employeeId, setEmployeeId] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [boundUser, setBoundUser] = useState<any>(null)

  useEffect(() => {
    initLiff()
  }, [])

  const initLiff = async () => {
    try {
      // ⚠️ อย่าลืมใส่ NEXT_PUBLIC_LIFF_ID ใน .env.local หรือ Vercel Environment Variables
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' })
      
      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      const profile = await liff.getProfile()
      setLineUserId(profile.userId)

      // ตรวจสอบว่า line_user_id นี้เคยผูกไว้แล้วหรือยัง
      const { data } = await supabase
        .from('users')
        .select('*, departments(name)')
        .eq('line_user_id', profile.userId)
        .single()

      if (data) {
        setBoundUser(data)
      }
    } catch (err: any) {
      console.error('LIFF Init Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId.trim() || !phone.trim()) {
      alert('กรุณากรอกรหัสพนักงานและเบอร์โทรศัพท์ให้ครบถ้วน')
      return
    }

    setSubmitting(true)
    try {
      // 1. ตรวจสอบว่ามีพนักงานรหัสและเบอร์โทรนี้ในระบบไหม
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('employee_id', employeeId.trim())
        .eq('phone', phone.trim())
        .single()

      if (error || !user) {
        alert('❌ ไม่พบข้อมูลพนักงาน หรือเบอร์โทรศัพท์ไม่ถูกต้อง')
        setSubmitting(false)
        return
      }

      // 2. อัปเดต line_user_id เข้าตาราง users
      const { error: updateErr } = await supabase
        .from('users')
        .update({ line_user_id: lineUserId })
        .eq('id', user.id)

      if (updateErr) throw updateErr

      alert('🎉 ยืนยันตัวตนผูกบัญชี LINE สำเร็จ!')
      setBoundUser({ ...user, line_user_id: lineUserId })
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center text-slate-500 font-medium">กำลังโหลดข้อมูล LINE...</div>
      </div>
    )
  }

  // กรณีผูกบัญชีสำเร็จแล้ว
  if (boundUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">
            ✅
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">เชื่อมต่อบัญชีแล้ว</h2>
            <p className="text-xs text-slate-500 mt-1">
              ยินดีต้อนรับคุณ <span className="font-bold text-slate-700">{boundUser.first_name} {boundUser.last_name}</span>
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-left text-xs space-y-1">
            <div className="text-slate-500">รหัสพนักงาน: <span className="font-bold text-slate-800">{boundUser.employee_id}</span></div>
            <div className="text-slate-500">ตำแหน่ง: <span className="font-bold text-slate-800">{boundUser.position || '-'}</span></div>
          </div>
          <button
            onClick={() => liff.closeWindow()}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    )
  }

  // ฟอร์มกรอกเพื่อยืนยันตัวตน
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2">
            🆔
          </div>
          <h1 className="text-xl font-bold text-slate-800">ยืนยันตัวตนพนักงาน</h1>
          <p className="text-xs text-slate-500">กรอกข้อมูลเพื่อเชื่อมต่อบัญชี LINE เข้ากับระบบ HR</p>
        </div>

        <form onSubmit={handleBind} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสพนักงาน *</label>
            <input
              type="text"
              placeholder="เช่น EMP001"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">เบอร์โทรศัพท์ *</label>
            <input
              type="tel"
              placeholder="08X-XXX-XXXX"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50"
          >
            {submitting ? 'กำลังตรวจสอบ...' : '🔗 ยืนยันผูกบัญชี LINE'}
          </button>
        </form>
      </div>
    </div>
  )
}