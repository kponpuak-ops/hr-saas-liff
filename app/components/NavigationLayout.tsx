'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function NavigationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [companyPackage, setCompanyPackage] = useState<string>('free') // 💡 เพิ่ม State เก็บชื่อแพ็กเกจ

  useEffect(() => {
    const checkAuth = async () => {
      if (pathname.startsWith('/liff') || pathname.startsWith('/bind')) {
        setIsChecking(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        if (pathname !== '/login') {
          router.push('/login')
        } else {
          setIsChecking(false)
        }
        return
      }

      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('role, company_id') // 💡 ดึง company_id มาด้วย
          .eq('auth_id', session.user.id)
          .single()

        const userRole = userData?.role

        // 💡 ดึงข้อมูลแพ็กเกจของบริษัท
        if (userData?.company_id) {
            const { data: compData } = await supabase
            .from('companies')
            .select('package_tier') // 💡 เปลี่ยนมาใช้ชื่อคอลัมน์ที่มีอยู่จริง
            .eq('id', userData.company_id)
            .single()
            
        if (compData && compData.package_tier) {
            // 💡 ใช้ replace ลบเครื่องหมาย " (ฟันหนู) ออกเผื่อติดมาใน DB แล้วทำเป็นตัวเล็ก
            const cleanPackage = compData.package_tier.replace(/"/g, '').toLowerCase()
            setCompanyPackage(cleanPackage)
        }
        }

        if (pathname.startsWith('/super-admin') && userRole !== 'super_admin') {
          router.push('/')
          return
        }

        if (pathname === '/' && userRole === 'super_admin') {
          router.push('/super-admin')
          return
        }

        if (pathname === '/login') {
          router.push(userRole === 'super_admin' ? '/super-admin' : '/')
          return
        }
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [pathname, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">กำลังตรวจสอบสิทธิ์...</div>
  }

  if (pathname.startsWith('/liff') || pathname.startsWith('/bind') || pathname === '/login' || pathname.startsWith('/super-admin')) {
    return <>{children}</>
  }

  // 💡 สร้างฟังก์ชันตัวช่วยเช็กสิทธิ์
  const canAccessFeature = (feature: string) => {
    switch (feature) {
      case 'advanced_settings': // เช่น กะการทำงานหมุนเวียน, สายอนุมัติหลายขั้น
        return ['trial', 'pro'].includes(companyPackage)
      case 'payroll_tax': // ระบบ ภ.ง.ด. / ภาษี
        return ['trial', 'pro'].includes(companyPackage)
      case 'photo_checkin': // เช็คอินด้วยรูปถ่าย
        return ['trial', 'pro'].includes(companyPackage)
      case 'multiple_admins': // แอดมินมากกว่า 1 คน
        return ['trial', 'pro'].includes(companyPackage)
      default:
        return true
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 text-2xl font-black text-indigo-400 border-b border-slate-800 tracking-wider">
          HR SaaS
          <div className="text-xs font-medium text-slate-400 mt-1 uppercase">Package: <span className="text-emerald-400">{companyPackage}</span></div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {/* เมนูพื้นฐาน (ทุกแพ็กเกจเข้าได้) */}
          <Link
            href="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">📊</span> ภาพรวมระบบ
          </Link>
          <Link
            href="/employees"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/employees' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">👥</span> รายชื่อพนักงาน
          </Link>
          <Link
            href="/attendance"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/attendance' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">📅</span> ประวัติลงเวลา
          </Link>
          <Link
            href="/leaves"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/leaves' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">📝</span> จัดการการลา
          </Link>
          <Link href="/ot" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-indigo-800 hover:text-white rounded-xl transition-all">
            <span>⏱️</span> จัดการ OT
          </Link>

          {/* 💡 ตัวอย่างการล็อกเมนู หรือแสดงสัญลักษณ์ตามแพ็กเกจ */}
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">⚙️</span> ตั้งค่าองค์กร 
            {!canAccessFeature('advanced_settings') && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded ml-auto">PRO</span>}
          </Link>
        </nav>

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