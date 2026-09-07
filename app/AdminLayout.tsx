'use client'

import { usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // หากเป็นหน้า LIFF (พนักงาน) ให้แสดงเนื้อหาเพียวๆ ไม่มีแถบเมนู
  if (pathname?.startsWith('/liff')) {
    return <>{children}</>
  }

  // หากเป็นหน้าอื่นๆ ให้แสดงโครงสร้าง Dashboard (สำหรับ HR)
  return (
    <div className="flex h-screen overflow-hidden">
      {/* เมนูด้านข้าง (Sidebar) */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col shadow-xl z-20">
        <div className="h-16 flex items-center justify-center border-b border-indigo-800 font-bold text-xl tracking-wider">
          HR SaaS
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <a href="/" className="block py-2.5 px-4 hover:bg-indigo-800 rounded-lg transition-colors">📊 แดชบอร์ดหลัก</a>
          <a href="#" className="block py-2.5 px-4 hover:bg-indigo-800 rounded-lg transition-colors">🏢 จัดการบริษัท</a>
          <a href="/users" className="block py-2.5 px-4 bg-indigo-700 rounded-lg shadow-sm">👥 จัดการพนักงาน</a>
          <a href="#" className="block py-2.5 px-4 hover:bg-indigo-800 rounded-lg transition-colors">⚙️ ตั้งค่าระบบ</a>
        </nav>
      </aside>

      {/* พื้นที่หลักด้านขวา */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* แถบเมนูด้านบน (Navbar) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="text-lg font-medium text-slate-600">ภาพรวมระบบ (Overview)</div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Super Admin</span>
            <div className="w-9 h-9 bg-indigo-100 rounded-full border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
              A
            </div>
          </div>
        </header>

        {/* พื้นที่แสดงเนื้อหา */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}