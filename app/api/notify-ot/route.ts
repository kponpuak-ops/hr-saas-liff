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
    // 💡 แก้ไขให้รับค่า id แทน otId
    const { id, status } = body

    const { data: ot, error: otError } = await supabase
      .from('ot_requests')
      .select('*, users!inner(*)')
      .eq('id', id)
      .single()

    if (otError || !ot) throw new Error('ไม่พบข้อมูลการขอ OT')

    const companyId = ot.users.company_id
    const department = ot.users.department
    const employeeName = `${ot.users.first_name} ${ot.users.last_name}`
    const employeeLineId = ot.users.line_user_id
    const role = ot.users.role

    const { data: settings } = await supabase
      .from('company_settings')
      .select('approval_workflow')
      .eq('company_id', companyId)
      .single()

    const isTwoStep = settings?.approval_workflow === 'manager_approval'

    let targetLineIds: string[] = []
    let message = ''
    
    const otDate = new Date(ot.ot_date || ot.request_date).toLocaleDateString('th-TH')
    const timeRange = `${ot.start_time.substring(0,5)} - ${ot.end_time.substring(0,5)} น.`

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
        message = `⏱️ มีคำขอ OT ใหม่ (รอหัวหน้าอนุมัติ)\nจาก: ${employeeName}\nวันที่: ${otDate}\nเวลา: ${timeRange}\nกรุณาตรวจสอบในระบบ`
      } else {
        const { data: admins } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('company_id', companyId)
          .eq('role', 'admin')
          .not('line_user_id', 'is', null)
        
        targetLineIds = admins?.map(a => a.line_user_id) || []
        message = `⏱️ มีคำขอ OT ใหม่ (รอดำเนินการ)\nจาก: ${employeeName}\nวันที่: ${otDate}\nเวลา: ${timeRange}\nกรุณาตรวจสอบในระบบ`
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
      message = `🟡 หัวหน้างานอนุมัติ OT แล้ว (รอ HR)\nจาก: ${employeeName}\nวันที่: ${otDate}\nเวลา: ${timeRange}\nกรุณาตรวจสอบขั้นสุดท้ายในระบบ`
    } 
    else if (status === 'approved' || status === 'rejected') {
      if (employeeLineId) targetLineIds = [employeeLineId]
      const statusText = status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'
      message = `📢 แจ้งผลการขอ OT:\nวันที่: ${otDate}\nเวลา: ${timeRange}\nสถานะ: ${statusText}`
    }

    if (targetLineIds.length > 0 && message) {
      await pushLineMessage(targetLineIds, message)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}