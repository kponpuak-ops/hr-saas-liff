'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function NavigationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      // 1. ถ้าเป็นหน้ามือถือพนักงาน (LIFF) ให้ผ่านได้เลยไม่ต้องเช็คล็อคอิน
      if (pathname.startsWith('/liff')) {
        setIsChecking(false)
        return
      }

      // 2. ดึงข้อมูลสถานะการล็อคอินปัจจุบัน
      const { data: { session } } = await supabase.auth.getSession()

      // 3. เช็คเงื่อนไขและเด้งหน้า
      if (!session && pathname !== '/login') {
        router.push('/login') // ไม่มีสิทธิ์ ให้ไปหน้า login
      } else if (session && pathname === '/login') {
        router.push('/') // ล็อคอินแล้ว ไม่ต้องอยู่หน้า login ให้ไปหน้าแรก
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [pathname, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ป้องกันหน้าจอกระพริบระหว่างระบบกำลังตรวจสอบสิทธิ์
  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">กำลังตรวจสอบสิทธิ์...</div>
  }

  if (pathname.startsWith('/liff') || pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 text-2xl font-black text-indigo-400 border-b border-slate-800 tracking-wider">
          HR SaaS
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link 
            href="/" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">👥</span> รายชื่อพนักงาน
          </Link>
          <Link 
            href="/attendance" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/attendance' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">📅</span> ประวัติลงเวลา
          </Link>
          {/* เพิ่มเมนูนี้ลงไปครับ */}
        <Link 
          href="/settings" 
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <span className="text-xl">⚙️</span> ตั้งค่าองค์กร
        </Link>
        </nav>
        
        {/* ส่วนปุ่มออกจากระบบด้านล่างสุด */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-colors font-medium text-sm"
          >
            <span>🚪</span> ออกจากระบบ
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-8 overflow-auto">
        {children}
      </div>
    </div>
  )
}