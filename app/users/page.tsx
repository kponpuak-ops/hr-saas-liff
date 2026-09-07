export const dynamic = 'force-dynamic'
import { supabase } from '../../lib/supabase'
import AddUserModal from './AddUserModal'

export default async function UsersPage() {
  const { data: users, error } = await supabase.from('users').select('*').order('id', { ascending: false })

  if (error) return <div className="p-4 text-red-500">เกิดข้อผิดพลาด: {error.message}</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">จัดการพนักงาน (Users)</h1>
        <AddUserModal />
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {users?.length === 0 || !users ? (
          <p className="text-slate-500 text-center py-4">ยังไม่มีข้อมูลพนักงานในระบบ</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                <th className="pb-3 font-medium">บทบาท (Role)</th>
                <th className="pb-3 font-medium">รหัสผูก LINE (Binding Code)</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 font-medium text-slate-800">{user.first_name} {user.last_name}</td>
                  <td className="py-4 text-sm text-slate-500 uppercase">{user.role}</td>
                  <td className="py-4">
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-md font-mono font-bold tracking-widest">
                      {user.binding_code || 'ยังไม่มีรหัส'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}