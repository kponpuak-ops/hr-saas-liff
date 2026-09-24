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
  const [companyPackage, setCompanyPackage] = useState<string>('free')

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
          .select('role, company_id')
          .eq('auth_id', session.user.id)
          .single()

        const userRole = userData?.role

        if (userData?.company_id) {
            const { data: compData } = await supabase
            .from('companies')
            .select('package_tier')
            .eq('id', userData.company_id)
            .single()
            
            if (compData && compData.package_tier) {
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

  const canAccessFeature = (feature: string) => {
    switch (feature) {
      case 'advanced_settings': 
      case 'payroll_tax': 
      case 'photo_checkin': 
      case 'multiple_admins': 
      case 'audit_log': 
      case 'management_report': 
        return ['trial', 'pro'].includes(companyPackage)
      default:
        return true
    }
  }

  // Helper สำหรับสร้างสไตล์เมนูให้สะอาดตา
  const getMenuClass = (path: string, isExact: boolean = false) => {
    const isActive = isExact ? pathname === path : pathname.includes(path)
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-[13px] ${
      isActive 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`
  }

  return (
    // 💡 ล็อกความสูงหน้าจอด้วย h-screen และ overflow-hidden
    <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar - Fix height & Flex Column */}
      <aside className="w-[260px] bg-[#0f172a] flex flex-col h-full flex-shrink-0 shadow-2xl relative z-20 border-r border-slate-800">
        
        {/* 1. Header (Logo) - ไม่เลื่อน */}
        <div className="flex-shrink-0 p-5 border-b border-slate-800/60 flex flex-col gap-3 items-center">
          <Link href="/" className="w-full flex items-center justify-center hover:opacity-80 transition-opacity min-h-[60px]">
            <Image 
              src="/apro-logo.png" 
              alt="APro HR Logo" 
              width={160} 
              height={160} 
              className="object-contain mx-auto rounded-xl"
              priority
            />
          </Link>
          <div className="flex flex-col items-center w-full">
            <span className="text-[14px] font-black text-indigo-400 tracking-[0.15em] uppercase mb-1.5">
              HR Platform
            </span>
            <div className="text-[10px] font-bold text-slate-400 uppercase bg-slate-800/80 px-3 py-1 rounded-md w-full text-center border border-slate-700">
              Plan: <span className="text-emerald-400 ml-1">{companyPackage}</span>
            </div>
          </div>
        </div>

        {/* 2. Menu Navigation - เลื่อนได้อิสระเมื่อเมนูเยอะเกินจอ */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 mb-2 px-2">Operations</div>
          <Link href="/" className={getMenuClass('/', true)}>
            <span className="w-6 text-center text-lg">📊</span> ภาพรวมระบบ
          </Link>
          <Link href="/attendance" className={getMenuClass('/attendance')}>
            <span className="w-6 text-center text-lg">📅</span> ประวัติลงเวลา
          </Link>
          <Link href="/admin/attendance-requests" className={getMenuClass('/attendance-requests')}>
            <span className="w-6 text-center text-lg">⏱️</span> คำขอแก้เวลา
          </Link>

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2 px-2">Management</div>
          <Link href="/employees" className={getMenuClass('/employees')}>
            <span className="w-6 text-center text-lg">👥</span> รายชื่อพนักงาน
          </Link>
          <Link href="/leaves" className={getMenuClass('/leaves')}>
            <span className="w-6 text-center text-lg">📝</span> จัดการการลา
          </Link>
          <Link href="/ot" className={getMenuClass('/ot')}>
            <span className="w-6 text-center text-lg">⌛</span> จัดการ OT
          </Link>
          <Link href="/payroll" className={getMenuClass('/payroll')}>
            <span className="w-6 text-center text-lg">💰</span> จัดการเงินเดือน
          </Link>

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2 px-2">Administration</div>
          <Link href="/admin/reports" className={`${getMenuClass('/reports')} ${!canAccessFeature('management_report') ? 'opacity-70' : ''}`}>
            <span className="w-6 text-center text-lg">📈</span> รายงานผู้บริหาร
            {!canAccessFeature('management_report') && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded ml-auto">PRO</span>}
          </Link>
          <Link href="/audit-log" className={`${getMenuClass('/audit-log')} ${!canAccessFeature('audit_log') ? 'opacity-70' : ''}`}>
            <span className="w-6 text-center text-lg">🕵️</span> ประวัติระบบ
            {!canAccessFeature('audit_log') && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded ml-auto">PRO</span>}
          </Link>
          <Link href="/settings" className={`${getMenuClass('/settings')} ${!canAccessFeature('advanced_settings') ? 'opacity-70' : ''}`}>
            <span className="w-6 text-center text-lg">⚙️</span> ตั้งค่าองค์กร 
            {!canAccessFeature('advanced_settings') && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded ml-auto">PRO</span>}
          </Link>

        </nav>

        {/* 3. Footer (Logout) - ถูกปักหมุดไว้ล่างสุดเสมอ */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800/60 bg-slate-900/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-all font-medium text-sm border border-slate-700 hover:border-rose-600 shadow-sm"
          >
            <span className="text-lg">🚪</span> ออกจากระบบ
          </button>
        </div>

      </aside>

      {/* 4. Main Content - พื้นที่ฝั่งขวาที่เลื่อนอิสระ */}
      <main className="flex-1 h-full overflow-y-auto bg-slate-50/50">
        <div className="p-8 min-h-full">
          {children}
        </div>
      </main>

    </div>
  )
}