import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email, password, name, company_id } = await req.json()

    // 1. สร้างบัญชีในระบบล็อกอินหลัก (auth.users)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    })

    if (authError) throw authError

    // 2. นำ ID ที่ได้มาสร้างโปรไฟล์ในตารางพนักงาน (public.users)
    const { error: dbError } = await supabaseAdmin.from('users').insert([
      {
        auth_id: authData.user.id,
        email: email,
        first_name: name, 
        last_name:'-',
        company_id: company_id,
        role: 'admin' // ให้สิทธิ์เป็น Admin ของบริษัท
      }
    ])

    if (dbError) {
      // Rollback: ถ้าบันทึกโปรไฟล์พัง ให้ลบบัญชีล็อกอินทิ้ง
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    return NextResponse.json({ success: true, message: 'สร้างบัญชีแอดมินสำเร็จ' })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}