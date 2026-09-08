'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    onLeaveToday: 0,
    pendingLeaves: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    setIsLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]

    try {
      // 1. จำนวนพนักงานทั้งหมด
      const { count: employeeCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // 2. การลงเวลาวันนี้
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .gte('check_in', `${todayStr}T00:00:00`)
        .lte('check_in', `${todayStr}T23:59:59`)

      const presentCount = attendanceData ? attendanceData.length : 0
      const lateCount = attendanceData ? attendanceData.filter(a => a.status === 'late').length : 0

      // 3. คนที่ลาวันนี้ (ได้รับอนุมัติแล้ว และช่วงวันตรงกับวันนี้)
      const { count: leaveCount } = await supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .lte('start_date', todayStr)
        .gte('end_date', todayStr)

      // 4. ใบลารออนุมัติ
      const { count: pendingCount } = await supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      setStats({
        totalEmployees: employeeCount || 0,
        presentToday: presentCount,
        lateToday: lateCount,
        onLeaveToday: leaveCount || 0,
        pendingLeaves: pendingCount || 0,
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="p-4 text-slate-500 font-medium">กำลังโหลดข้อมูลภาพรวม...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ดภาพรวม (Analytics Overview)</h1>
          <p className="text-slate-500 text-sm">
            ข้อมูลประจำวันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={fetchDashboardStats}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          🔄 รีเฟรชข้อมูล
        </button>
      </div>

      {/* สรุปการ์ดสถิติ 5 ช่อง */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 text-sm font-medium">พนักงานทั้งหมด</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-lg">👥</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{stats.totalEmployees}</div>
          <span className="text-xs text-slate-400">คนในระบบ</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 text-sm font-medium">มาทำงานวันนี้</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-lg">✅</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{stats.presentToday}</div>
          <span className="text-xs text-slate-400">ลงเวลาเข้างานแล้ว</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 text-sm font-medium">เข้าสายวันนี้</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg text-lg">⏰</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{stats.lateToday}</div>
          <span className="text-xs text-slate-400">หลังเวลาที่กำหนด</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 text-sm font-medium">ลาวันนี้</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg text-lg">🏖️</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{stats.onLeaveToday}</div>
          <span className="text-xs text-slate-400">อนุมัติแล้ว</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 text-sm font-medium">ใบลารออนุมัติ</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-lg text-lg">📑</span>
          </div>
          <div className="text-3xl font-bold text-rose-600">{stats.pendingLeaves}</div>
          <span className="text-xs text-slate-400">รอดำเนินการ</span>
        </div>
      </div>

      {/* ทางลัดไปยังหน้าจัดการต่างๆ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2">📅 การลงเวลาวันนี้</h2>
          <p className="text-slate-500 text-sm mb-4">ตรวจสอบรายชื่อพนักงานที่ลงเวลาเข้า-ออกงานในวันนี้แบบละเอียด</p>
          <Link 
            href="/attendance"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
          >
            ดูประวัติลงเวลาทั้งหมด →
          </Link>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2">📝 รายการอนุมัติการลา</h2>
          <p className="text-slate-500 text-sm mb-4">มีใบลารอดำเนินการ {stats.pendingLeaves} รายการ สามารถเข้าไปพิจารณาอนุมัติได้ทันที</p>
          <Link 
            href="/leaves"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
          >
            ไปที่หน้าจัดการการลา →
          </Link>
        </div>
      </div>
    </div>
  )
}