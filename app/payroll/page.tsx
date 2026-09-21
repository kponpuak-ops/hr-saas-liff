'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PayrollCyclesPage() {
  const router = useRouter()
  const [cycles, setCycles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [companyId, setCompanyId] = useState<number | null>(null)
  
  // State สร้างรอบบิลใหม่
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentDate, setPaymentDate] = useState('')

  // State แก้ไขรอบบิล
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<any>({
    id: '', name: '', start_date: '', end_date: '', payment_date: ''
  })

  useEffect(() => {
    fetchCycles()
  }, [])

  const fetchCycles = async () => {
    setIsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_id', session.user.id)
      .single()

    if (userData?.company_id && (userData.role === 'admin' || userData.role === 'super_admin')) {
      setCompanyId(userData.company_id)

      const { data } = await supabase
        .from('payroll_cycles')
        .select('*')
        .eq('company_id', userData.company_id)
        .order('start_date', { ascending: false })

      setCycles(data || [])
    }
    setIsLoading(false)
  }

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    const { data, error } = await supabase
      .from('payroll_cycles')
      .insert([{
        company_id: companyId,
        name,
        start_date: startDate,
        end_date: endDate,
        payment_date: paymentDate,
        status: 'draft'
      }])
      .select()

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      setCycles([data[0], ...cycles])
      setShowModal(false)
      setName('')
      setStartDate('')
      setEndDate('')
      setPaymentDate('')
    }
  }

  const handleDeleteCycle = async (id: string, status: string) => {
    if (status === 'completed') {
      alert('❌ ไม่อนุญาตให้ลบรอบเงินเดือนที่ "อนุมัติและเผยแพร่แล้ว" เพื่อป้องกันข้อมูลบัญชีคลาดเคลื่อน')
      return
    }
    
    if (!confirm('⚠️ ยืนยันการลบรอบเงินเดือนนี้?\n(ข้อมูลสลิปที่กำลังคำนวณอยู่ในรอบนี้จะถูกลบทั้งหมด)')) return

    try {
      const { error } = await supabase.from('payroll_cycles').delete().eq('id', id)
      if (error) throw error
      alert('✅ ลบรอบเงินเดือนเรียบร้อยแล้ว')
      fetchCycles()
    } catch (error) {
      console.error(error)
      alert('เกิดข้อผิดพลาดในการลบข้อมูล')
    }
  }

  const handleUpdateCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('payroll_cycles')
        .update({
          name: editForm.name,
          start_date: editForm.start_date,
          end_date: editForm.end_date,
          payment_date: editForm.payment_date
        })
        .eq('id', editForm.id)

      if (error) throw error
      alert('✅ บันทึกการแก้ไขเรียบร้อยแล้ว')
      setIsEditModalOpen(false)
      fetchCycles()
    } catch (error) {
      console.error(error)
      alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูล')
    }
  }

  const openEditModal = (cycle: any) => {
    setEditForm({
      id: cycle.id,
      name: cycle.name,
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      payment_date: cycle.payment_date
    })
    setIsEditModalOpen(true)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (isLoading) return <div className="p-6 text-slate-500">กำลังโหลดข้อมูล...</div>

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">จัดการรอบเงินเดือน (Payroll Cycles)</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors"
        >
          + สร้างรอบบิลใหม่
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {cycles.length === 0 ? (
          <p className="text-slate-500 text-center py-8">ยังไม่มีข้อมูลรอบเงินเดือน กดปุ่มสร้างรอบบิลใหม่เพื่อเริ่มต้น</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                <th className="p-4 font-bold">ชื่อรอบเงินเดือน</th>
                <th className="p-4 font-bold text-center">วันที่เริ่มต้น - สิ้นสุด</th>
                <th className="p-4 font-bold text-center">วันที่จ่ายเงิน</th>
                <th className="p-4 font-bold text-center">สถานะ</th>
                <th className="p-4 font-bold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cycles.map((cycle) => (
                <tr key={cycle.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-800">{cycle.name}</td>
                  <td className="p-4 text-sm text-slate-600 text-center">
                    {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
                  </td>
                  <td className="p-4 text-sm font-bold text-indigo-600 text-center">
                    {formatDate(cycle.payment_date)}
                  </td>
                  <td className="p-4 text-center">
                    {cycle.status === 'draft' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">ร่าง (Draft)</span>}
                    {cycle.status === 'processing' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">กำลังคำนวณ</span>}
                    {cycle.status === 'completed' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">เสร็จสิ้น</span>}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(cycle)}
                        className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        ✏️ แก้ไข
                      </button>
                      <button
                        onClick={() => handleDeleteCycle(cycle.id, cycle.status)}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        🗑️ ลบ
                      </button>
                      <button
                        onClick={() => router.push(`/payroll/${cycle.id}`)}
                        className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors"
                      >
                        คำนวณเงินเดือน ➔
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal สร้างรอบบิลใหม่ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">สร้างรอบเงินเดือนใหม่</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 transition font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateCycle} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อรอบ (เช่น รอบเดือน กันยายน 2569)</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="ระบุชื่อรอบเงินเดือน..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">วันที่เริ่มต้น</label>
                  <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">วันที่สิ้นสุด</label>
                  <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">วันที่จ่ายเงิน (วันเงินเดือนออก)</label>
                <input required type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" />
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ Modal แก้ไขรอบเงินเดือน */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">✏️ แก้ไขรอบเงินเดือน</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateCycle} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อรอบเงินเดือน</label>
                <input type="text" required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">วันที่เริ่มต้น</label>
                  <input type="date" required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">วันที่สิ้นสุด</label>
                  <input type="date" required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" value={editForm.end_date} onChange={e => setEditForm({...editForm, end_date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">วันที่กำหนดจ่ายเงิน</label>
                <input type="date" required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" value={editForm.payment_date} onChange={e => setEditForm({...editForm, payment_date: e.target.value})} />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">ยกเลิก</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">💾 บันทึกการแก้ไข</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}