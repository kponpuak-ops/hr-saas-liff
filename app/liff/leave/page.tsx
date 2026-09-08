'use client'

import { useState, useEffect } from 'react'
import liff from '@line/liff'
import { supabase } from '@/lib/supabase'

export default function LeavePage() {
  const [userDbId, setUserDbId] = useState<number | null>(null)
  const [leaveType, setLeaveType] = useState('ลาป่วย')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('line_user_id', profile.userId)
            .single()

          if (userData) setUserDbId(userData.id)
        } else {
          liff.login()
        }
      } catch (err) {
        console.error('LIFF Init error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    initLiff()
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
    if (!userDbId) {
      setMessage('ไม่พบข้อมูลบัญชีพนักงาน กรุณาผูกบัญชีก่อน')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    const { error } = await supabase
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

    if (error) {
      setMessage('เกิดข้อผิดพลาดในการยื่นใบลา')
    } else {
      setMessage('ยื่นใบลาเรียบร้อยแล้ว! รอ HR อนุมัติ')
      setReason('')
      setStartDate('')
      setEndDate('')
      setAttachmentUrl('')
      
      // รีเซ็ต input file
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return <div className="p-6 text-center text-slate-500 font-medium">กำลังโหลด...</div>
  }

  if (!userDbId) {
    return (
      <div className="p-6 text-center text-rose-500 font-medium">
        ยังไม่ได้ผูกบัญชีพนักงาน กรุณากลับไปหน้าหลักเพื่อผูกบัญชีก่อน
      </div>
    )
  }

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
              <option value="ลาป่วย">ลาป่วย</option>
              <option value="ลากิจ">ลากิจ</option>
              <option value="ลาพักร้อน">ลาพักร้อน</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">วันที่เริ่มลา *</label>
              <input 
                type="date" 
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ถึงวันที่ *</label>
              <input 
                type="date" 
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
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
              className="w-full p-3 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
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