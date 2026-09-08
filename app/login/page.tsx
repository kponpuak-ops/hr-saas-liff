'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
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

    // ตรวจสอบกับ Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorStr('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } else {
      router.push('/') // ล็อคอินสำเร็จให้ไปที่หน้า Dashboard
      router.refresh()
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-indigo-600 mb-2">HR SaaS</h1>
          <p className="text-slate-500">ลงชื่อเข้าใช้สำหรับผู้ดูแลระบบ</p>
        </div>

        {errorStr && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-lg text-sm text-center font-medium">
            {errorStr}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-medium p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-4"
          >
            {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}