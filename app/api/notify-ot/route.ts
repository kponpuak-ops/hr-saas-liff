import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { otId, status } = await req.json()

    // ดึงข้อมูลคำขอ OT และข้อมูลพนักงาน
    const { data: otData, error } = await supabase
      .from('ot_requests')
      .select('*, users(line_user_id, first_name)')
      .eq('id', otId)
      .single()

    if (error || !otData) throw new Error('OT request not found')

    const lineUserId = otData.users?.line_user_id
    
    if (!lineUserId) {
      return NextResponse.json({ success: true, message: 'No LINE ID found' })
    }

    const statusIcon = status === 'approved' ? '✅' : '❌'
    const statusText = status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'
    const otDate = new Date(otData.request_date).toLocaleDateString('th-TH', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    })
    const timeText = `${otData.start_time.substring(0, 5)} - ${otData.end_time.substring(0, 5)} น.`

    const message = `${statusIcon} แจ้งเตือนผลการขอทำ OT\n\nสถานะ: ${statusText}\nวันที่: ${otDate}\nเวลา: ${timeText}\n\nตรวจสอบรายละเอียดเพิ่มเติมได้ที่เมนู "ยื่นขอ OT" ครับ`

    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }],
      }),
    })

    if (!lineResponse.ok) {
      throw new Error('Failed to send LINE message')
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}