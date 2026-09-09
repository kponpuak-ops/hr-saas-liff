'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase' // ตรวจสอบ Path ให้ตรงกับโปรเจกต์คุณ
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorStr, setErrorStr] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorStr('')

    // 1. ตรวจสอบอีเมลและรหัสผ่านกับระบบ Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      setErrorStr('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setIsLoading(false)
      return
    }

    // 2. ดึงข้อมูลโปรไฟล์ผู้ใช้งานจากตาราง users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('auth_id', authData.user.id)
      .single()

    if (userError || !userData) {
      await supabase.auth.signOut()
      setErrorStr('ไม่พบข้อมูลโปรไฟล์ในระบบ')
      setIsLoading(false)
      return
    }

    // 3. ตรวจสอบสถานะ "Kill Switch" ของบริษัท (กรณีที่ไม่ใช่ Super Admin)
    if (userData.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('is_active')
        .eq('id', userData.company_id)
        .single()

      if (companyData && companyData.is_active === false) {
        // หากบริษัทถูกระงับ ให้บังคับออกจากระบบทันที
        await supabase.auth.signOut()
        setErrorStr('ระบบของบริษัทคุณถูกระงับการใช้งาน โปรดติดต่อผู้ให้บริการ')
        setIsLoading(false)
        return
      }
    }

    // 4. แยกเส้นทางตาม Role
    if (userData.role === 'super_admin') {
      router.push('/super-admin')
    } else {
      router.push('/') // ไปหน้า Dashboard ของบริษัท
    }
    
    router.refresh()
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-indigo-600 mb-2">HR SaaS</h1>
          <p className="text-slate-500">ลงชื่อเข้าใช้งานระบบ</p>
        </div>

        {errorStr && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-lg text-sm text-center font-bold">
            {errorStr}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">อีเมล</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">รหัสผ่าน</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-4 text-sm"
          >
            {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}