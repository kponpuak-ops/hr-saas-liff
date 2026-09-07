'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function NavigationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // ถ้า URL ปัจจุบันมีคำว่า /liff ให้แสดงแค่เนื้อหาเพียวๆ ไม่ต้องมีเมนู (สำหรับมือถือพนักงาน)
  if (pathname.startsWith('/liff')) {
    return <>{children}</>
  }

  // ถ้าเป็นหน้าอื่นๆ (ของ HR) ให้แสดง Sidebar ด้านซ้าย
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* แถบเมนูด้านซ้าย (Sidebar) */}
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
        </nav>
        <div className="p-4 text-xs text-slate-500 text-center border-t border-slate-800">
          ระบบจัดการทรัพยากรบุคคล v1.0
        </div>
      </div>
      
      {/* พื้นที่เนื้อหาหลักด้านขวา */}
      <div className="flex-1 p-8 overflow-auto">
        {children}
      </div>
    </div>
  )
}