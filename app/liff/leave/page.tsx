'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'

export default function LeavePage() {
  const [userDbId, setUserDbId] = useState<number | null>(null)
  const [userCompanyId, setUserCompanyId] = useState<number | null>(null)
  
  // States สำหรับประเภทการลา
  const [leaveTypes, setLeaveTypes] = useState<any[]>([])
  const [leaveType, setLeaveType] = useState('')
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const initData = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          
          // 1. ดึงข้อมูลพนักงาน (รวม company_id)
          const { data: userData } = await supabase
            .from('users')
            .select('id, company_id')
            .eq('line_user_id', profile.userId)
            .single()

          if (userData) {
            setUserDbId(userData.id)
            setUserCompanyId(userData.company_id)
            
            // 2. ดึงประเภทการลาเฉพาะของบริษัทพนักงาน
            const { data: typesData } = await supabase
              .from('leave_types')
              .select('*')
              .eq('company_id', userData.company_id)
              .order('id', { ascending: true })
              
            if (typesData && typesData.length > 0) {
              setLeaveTypes(typesData)
              setLeaveType(typesData[0].name)
            }
          }
        } else {
          liff.login()
        }
      } catch (err) {
        console.error('Init error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    initData()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('leave_attachments')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('leave_attachments')
        .getPublicUrl(fileName)

      setAttachmentUrl(publicUrlData.publicUrl)
    } catch (error: any) {
      alert('อัปโหลดไฟล์ไม่สำเร็จ: ' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userDbId || !userCompanyId) {
      setMessage('ไม่พบข้อมูลบัญชีพนักงาน กรุณาผูกบัญชีก่อน')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    // บันทึกคำขอลา
    const { data: newLeave, error } = await supabase
      .from('leaves')
      .insert([
        {
          user_id: userDbId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
          attachment_url: attachmentUrl,
          status: 'pending',
        },
      ])
      .select()
      .single()

    if (error) {
      setMessage('เกิดข้อผิดพลาดในการยื่นใบลา: ' + error.message)
    } else {
      setMessage('ยื่นใบลาเรียบร้อยแล้ว! รอหัวหน้างานอนุมัติ')
      
      // เรียก API ส่งแจ้งเตือน โดยส่ง company_id ไปให้ API ตัดสินใจเรื่องสายอนุมัติ
      fetch('/api/notify-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: newLeave.id, 
          status: 'pending',
        }),
      }).catch((err) => console.error('Notification error:', err))

      // รีเซ็ตฟอร์ม
      setReason('')
      setStartDate('')
      setEndDate('')
      setAttachmentUrl('')
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return <div className="p-6 text-center text-slate-500 font-medium">กำลังโหลดข้อมูลระบบ...</div>
  }

  if (!userDbId) {
    return (
      <div className="p-6 text-center text-rose-500 font-medium">
        ยังไม่ได้ผูกบัญชีพนักงาน กรุณากลับไปหน้าหลักเพื่อผูกบัญชีก่อน
      </div>
    )
  }

  const selectedLeaveInfo = leaveTypes.find(l => l.name === leaveType)

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-8">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            📝 ยื่นใบลา
          </h1>
          <button 
            onClick={() => window.location.href = '/liff'}
            className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition"
          >
            ✕ ปิด
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm text-center font-bold ${message.includes('เรียบร้อย') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">ประเภทการลา *</label>
            <select 
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.name}>{type.name}</option>
              ))}
            </select>

            {selectedLeaveInfo && (
              <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-600">
                  <span>สิทธิ์การรับค่าจ้าง:</span>
                  <span className="font-bold text-indigo-700">{selectedLeaveInfo.max_paid_days === 999 ? 'ได้เงินตามจริง' : `${selectedLeaveInfo.max_paid_days} วัน/ปี`}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>พนักงานรายเดือน:</span>
                  <span className="font-bold">{selectedLeaveInfo.is_paid_for_monthly ? '✅ ได้เงิน' : '❌ ไม่ได้เงิน'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>พนักงานรายวัน:</span>
                  <span className="font-bold">{selectedLeaveInfo.is_paid_for_daily ? '✅ ได้เงิน' : '❌ ไม่ได้เงิน'}</span>
                </div>
                {!selectedLeaveInfo.allow_probation && (
                  <div className="mt-2 pt-2 border-t border-indigo-200 text-rose-600 font-bold text-center">
                    ⚠️ พนักงานทดลองงานไม่มีสิทธิ์ลาประเภทนี้
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">วันที่เริ่มลา *</label>
              <input 
                type="date" 
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ถึงวันที่ *</label>
              <input 
                type="date" 
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">แนบหลักฐาน (ถ้ามี)</label>
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center relative hover:bg-slate-100 transition">
              {attachmentUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-emerald-600 font-bold text-sm">✅ อัปโหลดไฟล์แล้ว</span>
                  <img src={attachmentUrl} alt="Preview" className="h-20 object-contain rounded-md" />
                  <button 
                    type="button"
                    onClick={() => {
                      setAttachmentUrl('');
                      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                    }}
                    className="text-xs text-rose-500 font-bold mt-1"
                  >
                    ลบไฟล์
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-2xl mb-2 block text-slate-400">📸</span>
                  <span className="text-xs font-medium text-slate-500">แตะเพื่อเลือกรูปภาพ หรือ ไฟล์</span>
                  <input 
                    id="file-upload"
                    type="file" 
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>
            {isUploading && <p className="text-xs text-amber-600 mt-1 font-bold">กำลังอัปโหลดไฟล์...</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">เหตุผลการลา</label>
            <textarea 
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลเพิ่มเติม..."
              className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || isUploading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-4"
          >
            {isSubmitting ? 'กำลังส่งใบลา...' : '📨 ส่งใบลา'}
          </button>
        </form>
      </div>
    </div>
  )
}