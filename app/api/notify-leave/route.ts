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
    // 💡 แก้ไขให้รับค่า id ตรงกับที่หน้า LIFF ส่งมา
    const { id, status } = body

    const { data: leave, error: leaveError } = await supabase
      .from('leaves')
      .select('*, users!inner(*)')
      .eq('id', id)
      .single()

    if (leaveError || !leave) throw new Error('ไม่พบข้อมูลการลา')

    const companyId = leave.users.company_id
    const department = leave.users.department
    const employeeName = `${leave.users.first_name} ${leave.users.last_name}`
    const employeeLineId = leave.users.line_user_id
    const role = leave.users.role

    const { data: settings } = await supabase
      .from('company_settings')
      .select('approval_workflow')
      .eq('company_id', companyId)
      .single()

    const isTwoStep = settings?.approval_workflow === 'manager_approval'

    let targetLineIds: string[] = []
    let message = ''
    
    const startDate = new Date(leave.start_date).toLocaleDateString('th-TH')
    const endDate = new Date(leave.end_date).toLocaleDateString('th-TH')
    const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`

    if (status === 'pending') {
      // 💡 ถ้าเป็นระบบ 2 ขั้น และคนขอคือ Staff ให้ส่งหา Manager ก่อน
      if (isTwoStep && role === 'staff') {
        const { data: managers } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('company_id', companyId)
          .eq('department', department)
          .eq('role', 'manager')
          .not('line_user_id', 'is', null)
        
        targetLineIds = managers?.map(m => m.line_user_id) || []
        message = `📝 มีคำขอลาใหม่ (รอหัวหน้าอนุมัติ)\nจาก: ${employeeName}\nประเภท: ${leave.leave_type}\nวันที่: ${dateRange}\nกรุณาตรวจสอบในระบบ`
      } else {
        // 💡 ระบบขั้นเดียว หรือคนขอเป็น Manager/Admin ให้ส่งหา Admin เลย
        const { data: admins } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('company_id', companyId)
          .eq('role', 'admin')
          .not('line_user_id', 'is', null)
        
        targetLineIds = admins?.map(a => a.line_user_id) || []
        message = `📝 มีคำขอลาใหม่ (รอดำเนินการ)\nจาก: ${employeeName}\nประเภท: ${leave.leave_type}\nวันที่: ${dateRange}\nกรุณาตรวจสอบในระบบ`
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
      message = `🟡 หัวหน้างานอนุมัติการลาแล้ว (รอ HR)\nจาก: ${employeeName}\nประเภท: ${leave.leave_type}\nวันที่: ${dateRange}\nกรุณาตรวจสอบขั้นสุดท้ายในระบบ`
    } 
    else if (status === 'approved' || status === 'rejected') {
      if (employeeLineId) targetLineIds = [employeeLineId]
      const statusText = status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'
      message = `📢 แจ้งผลการยื่นใบลา:\nประเภท: ${leave.leave_type}\nสถานะ: ${statusText}\nวันที่: ${dateRange}`
    }

    if (targetLineIds.length > 0 && message) {
      await pushLineMessage(targetLineIds, message)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}