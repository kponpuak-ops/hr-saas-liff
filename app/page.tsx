import { supabase } from '../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  // ดึงข้อมูลพนักงานทั้งหมดจากตาราง users
  const { data: employees, error } = await supabase
    .from('users')
    .select('*')
    .order('id', { ascending: true })

  if (error) return <div className="p-4 text-red-500">เกิดข้อผิดพลาด: {error.message}</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">รายชื่อพนักงาน</h1>
        {/* ในอนาคตสามารถเพิ่มปุ่ม "+ เพิ่มพนักงาน" ตรงนี้ได้ */}
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {!employees || employees.length === 0 ? (
          <p className="text-slate-500 text-center py-4">ยังไม่มีข้อมูลพนักงาน</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">รหัส (ID)</th>
                  <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                  <th className="pb-3 font-medium">ตำแหน่ง</th>
                  <th className="pb-3 font-medium">รหัสผูกบัญชี (6 หลัก)</th>
                  <th className="pb-3 font-medium">สถานะ LINE</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-4 text-sm text-slate-600">#{emp.id}</td>
                    <td className="py-4 font-medium text-slate-800">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="py-4 text-sm text-slate-500">{emp.role}</td>
                    <td className="py-4 font-mono text-indigo-600 font-bold">
                      {emp.binding_code || '-'}
                    </td>
                    <td className="py-4">
                      {emp.line_user_id ? (
                        <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> ผูกบัญชีแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          รอการผูกบัญชี
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}