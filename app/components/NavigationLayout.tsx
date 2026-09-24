'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Image from 'next/image'

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
      case 'audit_log': // 💡 เพิ่ม Audit log เข้าไปตรงนี้
        return ['trial', 'pro'].includes(companyPackage)
      case 'management_report': // 💡 เพิ่มเงื่อนไขสำหรับรายงานผู้บริหาร
        return ['trial', 'pro'].includes(companyPackage)
      default:
        return true
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-800 flex flex-col gap-2">
          {/* โลโก้ APro */}
          <Link href="/" className="w-full flex items-center justify-center hover:opacity-80 transition-opacity py-2 min-h-[80px]">
            <Image 
              src="/apro-logo.png" 
              alt="APro HR Logo" 
              width={200} 
              height={200} 
              className="object-contain mx-auto rounded-2xl" // 💡 เพิ่ม rounded-2xl ตรงนี้
              priority
            />
          </Link>
          {/* ข้อความแบรนด์ และ แพ็กเกจ */}
          <div className="flex flex-col items-center w-full mt-2">
            <span className="text-[16px] font-extrabold text-blue-400 tracking-[0.2em] uppercase mb-1.5">
              HR SaaS
            </span>
            <div className="text-[12px] font-medium text-slate-400 uppercase bg-slate-800/50 px-3 py-1 rounded-full w-full text-center">
              Package: <span className="text-emerald-400 font-bold ml-1">{companyPackage}</span>
            </div>
          </div>
          
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
            href="/admin/attendance-requests"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname.includes('/attendance-requests') ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">⏱️</span> คำขอแก้เวลา
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
          <Link href="/payroll" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-indigo-800 hover:text-white rounded-xl transition-all">
            <span>💰</span> จัดการเงินเดือน
          </Link>
          <div className="pt-4 pb-2">
            <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ส่วนผู้บริหาร</div>
          </div>

          {/* 💡 เพิ่มเมนูรายงานตรงนี้ */}
          {/* เมนูรายงานผู้บริหาร (แสดงป้าย PRO แต่กดเข้าหน้าเพจได้) */}
          <Link
            href="/admin/reports"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium 
              ${pathname.includes('/reports') ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              ${!canAccessFeature('management_report') ? 'opacity-70' : ''}
            `}
          >
            <span className="text-xl">📈</span> รายงานผู้บริหาร
            {!canAccessFeature('management_report') && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded ml-auto shadow-sm">PRO</span>}
          </Link>
          <Link
            href="/audit-log"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/audit-log' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">🕵️</span> ประวัติระบบ
            {!canAccessFeature('audit_log') && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded ml-auto">PRO</span>}
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