import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { leaveId, status } = await request.json()

    // 1. ดึงข้อมูลใบลาพร้อม LINE User ID ของพนักงาน
    const { data: leave, error } = await supabase
      .from('leaves')
      .select(`
        *,
        users (
          line_user_id,
          first_name,
          last_name
        )
      `)
      .eq('id', leaveId)
      .single()

    if (error || !leave || !leave.users?.line_user_id) {
      return NextResponse.json({ message: 'ไม่พบข้อมูล LINE User ID' }, { status: 400 })
    }

    const statusText = status === 'approved' ? '✅ ได้รับการอนุมัติแล้ว' : '❌ ไม่ได้รับการอนุมัติ'
    const messageText = `📢 แจ้งเตือนผลการยื่นใบลา\n\nเรียนคุณ ${leave.users.first_name} ${leave.users.last_name}\n\nรายการ: ${leave.leave_type}\nวันที่: ${leave.start_date} ถึง ${leave.end_date}\nสถานะ: ${statusText}`

    // 2. ส่ง Push Message ไปหาพนักงานผ่าน LINE Messaging API
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: leave.users.line_user_id,
        messages: [
          {
            type: 'text',
            text: messageText,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errData = await response.json()
      return NextResponse.json({ error: errData }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}