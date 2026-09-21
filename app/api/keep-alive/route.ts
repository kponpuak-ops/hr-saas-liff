import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase' // ปรับ path ให้ตรงกับไฟล์ supabase ของคุณ

export async function GET() {
  try {
    // ดึงข้อมูลแค่ 1 แถวจากตารางที่เบาที่สุด (เช่น companies) เพื่อให้เกิดการเชื่อมต่อ
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1)

    if (error) throw error

    return NextResponse.json({ 
      status: 'ok', 
      message: 'กระตุ้น Supabase สำเร็จ!',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message }, 
      { status: 500 }
    )
  }
}