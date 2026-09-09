import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ฟังก์ชันสำหรับส่งข้อความผ่าน LINE Messaging API
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
    const { leaveId, status } = body

    // 1. ดึงข้อมูลใบลาและพนักงาน
    const { data: leave, error: leaveError } = await supabase
      .from('leaves')
      .select('*, users!inner(*)')
      .eq('id', leaveId)
      .single()

    if (leaveError || !leave) throw new Error('ไม่พบข้อมูลใบลา')

    const companyId = leave.users.company_id
    const department = leave.users.department
    const employeeName = `${leave.users.first_name} ${leave.users.last_name}`
    const employeeLineId = leave.users.line_user_id

    // 2. เช็กการตั้งค่าบริษัทว่าอนุมัติกี่ขั้น
    const { data: settings } = await supabase
      .from('company_settings')
      .select('approval_workflow')
      .eq('company_id', companyId)
      .single()

    const isTwoStep = settings?.approval_workflow === 'manager_approval'

    // 3. กำหนดข้อความและผู้รับตามสถานะ
    let targetLineIds: string[] = []
    let message = ''

    if (status === 'pending') {
      if (isTwoStep) {
        // ส่งหา Manager ในแผนกเดียวกัน
        const { data: managers } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('company_id', companyId)
          .eq('department', department)
          .eq('role', 'manager')
          .not('line_user_id', 'is', null)
        
        targetLineIds = managers?.map(m => m.line_user_id) || []
        message = `📝 มีคำขอลาใหม่ (รอหัวหน้าอนุมัติ)\nจาก: ${employeeName}\nประเภท: ${leave.leave_type}\nกรุณาตรวจสอบในระบบ`
      } else {
        // ส่งหา Admin ทันที (กรณี Free/Basic)
        const { data: admins } = await supabase
          .from('users')
          .select('line_user_id')
          .eq('company_id', companyId)
          .eq('role', 'admin')
          .not('line_user_id', 'is', null)
        
        targetLineIds = admins?.map(a => a.line_user_id) || []
        message = `📝 มีคำขอลาใหม่ (รอดำเนินการ)\nจาก: ${employeeName}\nประเภท: ${leave.leave_type}\nกรุณาตรวจสอบในระบบ`
      }
    } 
    else if (status === 'manager_approved') {
      // ส่งหา Admin หลังจาก Manager อนุมัติแล้ว
      const { data: admins } = await supabase
        .from('users')
        .select('line_user_id')
        .eq('company_id', companyId)
        .eq('role', 'admin')
        .not('line_user_id', 'is', null)
      
      targetLineIds = admins?.map(a => a.line_user_id) || []
      message = `🟡 หัวหน้างานอนุมัติใบลาแล้ว (รอ HR)\nจาก: ${employeeName}\nประเภท: ${leave.leave_type}\nกรุณาตรวจสอบขั้นสุดท้ายในระบบ`
    } 
    else if (status === 'approved' || status === 'rejected') {
      // ส่งกลับหาพนักงานเพื่อแจ้งผล
      if (employeeLineId) targetLineIds = [employeeLineId]
      const statusText = status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'
      message = `แจ้งผลการยื่นใบลา:\nประเภท: ${leave.leave_type}\nสถานะ: ${statusText}\nวันที่: ${new Date(leave.start_date).toLocaleDateString('th-TH')} - ${new Date(leave.end_date).toLocaleDateString('th-TH')}`
    }

    // 4. ยิง API ของ LINE
    if (targetLineIds.length > 0 && message) {
      await pushLineMessage(targetLineIds, message)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}