import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function pushLineMessage(userIds: string[], text: string) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || userIds.length === 0) return;

  const url = 'https://api.line.me/v2/bot/message/multicast';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
  };

  const body = {
    to: userIds,
    messages: [{ type: 'text', text }]
  };

  try {
    await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (error) {
    console.error('Error sending LINE message:', error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id, status } = body

    // 💡 ดึงข้อมูลคำขอพร้อม join table users (ต้องระบุ fk ให้ชัดเจน)
    const { data: reqData, error: reqError } = await supabase
      .from('attendance_requests')
      .select('*, users!attendance_requests_user_id_fkey(*)')
      .eq('id', id)
      .single()

    if (reqError || !reqData) throw new Error('ไม่พบข้อมูลการขอปรับปรุงเวลา')

    const companyId = reqData.users.company_id
    const department = reqData.users.department
    const employeeName = `${reqData.users.first_name} ${reqData.users.last_name}`
    const employeeLineId = reqData.users.line_user_id
    const role = reqData.users.role

    const { data: settings } = await supabase
      .from('company_settings')
      .select('approval_workflow')
      .eq('company_id', companyId)
      .single()

    const isTwoStep = settings?.approval_workflow === 'manager_approval'

    let targetLineIds: string[] = []
    let message = ''
    
    const reqDate = new Date(reqData.request_date).toLocaleDateString('th-TH')
    const inTime = reqData.check_in_time ? reqData.check_in_time.substring(0,5) : '-'
    const outTime = reqData.check_out_time ? reqData.check_out_time.substring(0,5) : '-'
    const timeText = `เข้า: ${inTime} | ออก: ${outTime}`

    if (status === 'pending') {
      if (isTwoStep && role === 'staff') {
        const { data: managers } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('company_id', companyId)
          .eq('department', department)
          .eq('role', 'manager')
          .not('line_user_id', 'is', null)
        
        targetLineIds = managers?.map(m => m.line_user_id) || []
        message = `⏱️ คำขอแก้เวลาใหม่ (รอหัวหน้าตรวจสอบ)\nจาก: ${employeeName}\nวันที่: ${reqDate}\nเวลาที่แจ้ง: ${timeText}\nเหตุผล: ${reqData.reason}`
      } else {
        const { data: admins } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('company_id', companyId)
          .eq('role', 'admin')
          .not('line_user_id', 'is', null)
        
        targetLineIds = admins?.map(a => a.line_user_id) || []
        message = `⏱️ คำขอแก้เวลาใหม่ (รอดำเนินการ)\nจาก: ${employeeName}\nวันที่: ${reqDate}\nเวลาที่แจ้ง: ${timeText}\nเหตุผล: ${reqData.reason}`
      }
    } 
    else if (status === 'manager_approved') {
      const { data: admins } = await supabase
        .from('users')
        .select('line_user_id')
        .eq('company_id', companyId)
        .eq('role', 'admin')
        .not('line_user_id', 'is', null)
      
      targetLineIds = admins?.map(a => a.line_user_id) || []
      message = `🟡 หัวหน้าอนุมัติแก้เวลาแล้ว (รอ HR)\nจาก: ${employeeName}\nวันที่: ${reqDate}\nเวลาที่แจ้ง: ${timeText}\nกรุณาตรวจสอบและอัปเดตเวลาในระบบ`
    } 
    else if (status === 'approved' || status === 'rejected') {
      if (employeeLineId) targetLineIds = [employeeLineId]
      const statusText = status === 'approved' ? '✅ อนุมัติและปรับเวลาแล้ว' : '❌ ไม่อนุมัติ'
      message = `📢 แจ้งผลการขอแก้ไขเวลา:\nวันที่: ${reqDate}\nเวลาที่แจ้ง: ${timeText}\nสถานะ: ${statusText}`
    }

    if (targetLineIds.length > 0 && message) {
      await pushLineMessage(targetLineIds, message)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}