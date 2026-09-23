'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    onLeaveToday: 0,
    pendingLeaves: 0,
    otToday: 0,
    pendingOTs: 0,
  })
  
  const [lateAbsentList, setLateAbsentList] = useState<any[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [activityFeed, setActivityFeed] = useState<any[]>([])
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 💡 State สำหรับวันที่ (เริ่มต้นเป็นวันนี้)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  })

  // ดึงข้อมูลใหม่ทุกครั้งที่ selectedDate เปลี่ยน
  useEffect(() => {
    fetchDashboardStats()
  }, [selectedDate])

  const fetchDashboardStats = async () => {
    setIsLoading(true)
    // 💡 ใช้วันที่จาก State แทนวันนี้
    const targetDateStr = selectedDate 
    const targetDateObj = new Date(selectedDate)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: currentUser } = await supabase
        .from('users')
        .select('company_id, role, department')
        .eq('auth_id', session.user.id)
        .single()

      if (!currentUser?.company_id) return
      const companyId = currentUser.company_id

      // 1. ข้อมูลพนักงานทั้งหมด (ไม่รวม admin)
      const { data: employees } = await supabase
        .from('users')
        .select('id, first_name, last_name, department, position')
        .eq('company_id', companyId)
        .neq('role', 'super_admin')
        
      const employeeCount = employees?.length || 0

      // 2. ข้อมูลลงเวลา (อิงตามวันที่เลือก)
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*, users(first_name, last_name, department), work_shifts(*)')
        .eq('company_id', companyId)
        .eq('action_date', targetDateStr)

      // 3. ข้อมูลลา (อิงตามวันที่เลือก)
      const { data: leaveData } = await supabase
        .from('leaves')
        .select('*, users(first_name, last_name, department)')
        .eq('company_id', companyId)
        .lte('start_date', targetDateStr)
        .gte('end_date', targetDateStr)
        .eq('status', 'approved')

      const presentCount = attendanceData ? attendanceData.length : 0
      const leaveCount = leaveData ? leaveData.length : 0
      
      let lateCount = 0;
      let lateUsers: any[] = [];
      let presentUserIds: number[] = [];
      let onLeaveUserIds: number[] = leaveData?.map(l => l.user_id) || [];

      if (attendanceData) {
        attendanceData.forEach(record => {
          presentUserIds.push(record.user_id)
          
          const lateMins = record.late_minutes || 0;
          const earlyMins = record.early_leave_minutes || 0;

          if (lateMins > 0 || earlyMins > 0) {
            lateCount++;
            lateUsers.push({
              type: 'late_early',
              user: record.users,
              lateMins: lateMins,
              earlyMins: earlyMins
            });
          }
        });
      }

      const absentCount = Math.max(0, employeeCount - presentCount - leaveCount);
      
      let absentUsers: any[] = [];
      employees?.forEach(emp => {
        if (!presentUserIds.includes(emp.id) && !onLeaveUserIds.includes(emp.id)) {
          absentUsers.push({ type: 'absent', user: emp })
        }
      })

      setLateAbsentList([...lateUsers, ...absentUsers])

      // 4. รายการรออนุมัติ (Leave & OT) - ดึงข้อมูลล่าสุดเสมอ ไม่ขึ้นกับวันที่ค้นหา
      const { data: pendingLeavesData } = await supabase
        .from('leaves')
        .select('id, leave_type, start_date, created_at, users(first_name, last_name)')
        .eq('company_id', companyId)
        .in('status', ['pending', 'manager_approved'])
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: pendingOTsData } = await supabase
        .from('ot_requests')
        .select('id, request_date, start_time, end_time, created_at, users(first_name, last_name)')
        .eq('company_id', companyId)
        .in('status', ['pending', 'manager_approved'])
        .order('created_at', { ascending: false })
        .limit(5)
        
      const pendingLeaveCount = pendingLeavesData?.length || 0;
      const pendingOTCount = pendingOTsData?.length || 0;

      const combinedPending = [
        ...(pendingLeavesData?.map(l => ({ ...l, reqType: 'leave' })) || []),
        ...(pendingOTsData?.map(o => ({ ...o, reqType: 'ot' })) || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)

      setPendingApprovals(combinedPending)

      // 5. Activity Feed (อิงตามวันที่เลือก)
      const activities = [
        ...(attendanceData?.map(a => ({ type: 'check_in', time: a.check_in_time, name: a.users?.first_name })) || []),
        ...(attendanceData?.filter(a => a.check_out_time).map(a => ({ type: 'check_out', time: a.check_out_time, name: a.users?.first_name })) || [])
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6)
      
      setActivityFeed(activities)

      // 6. ข้อมูลกราฟ 7 วันย้อนหลัง (นับย้อนหลังจากวันที่เลือก)
      const sevenDaysAgo = new Date(targetDateObj);
      sevenDaysAgo.setDate(targetDateObj.getDate() - 6);
      const startGte = sevenDaysAgo.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

      const { data: weeklyAttendance } = await supabase
        .from('attendance')
        .select('action_date')
        .eq('company_id', companyId)
        .gte('action_date', startGte)
        .lte('action_date', targetDateStr)

      const weekChart = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(targetDateObj);
        d.setDate(targetDateObj.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        const shortDate = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' });
        
        const count = weeklyAttendance?.filter(a => a.action_date === dateStr).length || 0;
        weekChart.push({ name: shortDate, 'มาทำงาน': count });
      }
      setWeeklyData(weekChart)

      // ดึงข้อมูล OT อนุมัติแล้วของวันที่เลือก
      const { count: otTodayCount } = await supabase
        .from('ot_requests')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .eq('request_date', targetDateStr)

      setStats({
        totalEmployees: employeeCount,
        presentToday: presentCount,
        lateToday: lateCount,
        absentToday: absentCount,
        onLeaveToday: leaveCount,
        pendingLeaves: pendingLeaveCount,
        otToday: otTodayCount || 0,
        pendingOTs: pendingOTCount,
      })

    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 💡 ผูกสี (fill) ให้ตรงกับกรอบตัวเลขด้านบนอย่างถาวร
  const pieDataRaw = [
    { name: 'ตรงเวลา', value: stats.presentToday - stats.lateToday, fill: '#10b981' }, // สีเขียว (Emerald)
    { name: 'สาย/ออกก่อน', value: stats.lateToday, fill: '#f59e0b' }, // สีส้ม (Amber)
    { name: 'ขาดงาน', value: stats.absentToday, fill: '#ef4444' }, // สีแดง (Rose)
    { name: 'ลางาน', value: stats.onLeaveToday, fill: '#3b82f6' }, // สีฟ้า (Blue)
  ];
  
  // กรองค่าที่เป็น 0 ออกก่อนนำไปวาดกราฟ
  const pieData = pieDataRaw.filter(item => item.value > 0);

  // แปลงวันที่สำหรับโชว์บนหัวเว็บ
  const displayDate = new Date(selectedDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const isToday = selectedDate === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="pb-10 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Executive Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            ภาพรวมประจำวันที่ {displayDate} {isToday && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold ml-2">วันนี้</span>}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <span className="bg-slate-50 px-3 py-2 text-slate-500 text-xs font-bold border-r border-slate-200">
              📅 เลือกวันที่:
            </span>
            <input 
              type="date"
              value={selectedDate}
              max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 text-sm text-slate-700 outline-none font-medium cursor-pointer hover:bg-slate-50 transition"
            />
          </div>
          <button
            onClick={fetchDashboardStats}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2 h-[38px]"
          >
            🔄 รีเฟรช
          </button>
        </div>
      </div>

      {/* --- ส่วนที่ 1: การ์ดสรุปตัวเลข (KPIs) แบบ Modern SaaS --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        
        <Link href="/employees" className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300 hover:-translate-y-1 transition-all group block">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shadow-sm border border-indigo-100">👥</div>
            <span className="text-slate-300 group-hover:text-indigo-500 transition-colors">↗</span>
          </div>
          <div className="mt-3">
            <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">พนักงานทั้งหมด</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800">{stats.totalEmployees}</span>
              <span className="text-xs font-medium text-slate-400">คน</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 text-7xl opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-300 pointer-events-none">👥</div>
        </Link>

        <Link href="/attendance" className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-300 hover:-translate-y-1 transition-all group block">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl shadow-sm border border-emerald-100">✅</div>
            <span className="text-slate-300 group-hover:text-emerald-500 transition-colors">↗</span>
          </div>
          <div className="mt-3">
            <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">มาทำงาน</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600">{stats.presentToday}</span>
              <span className="text-xs font-medium text-slate-400">คน</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 text-7xl opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-300 pointer-events-none">✅</div>
        </Link>

        <Link href="/attendance" className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-amber-300 hover:-translate-y-1 transition-all group block">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl shadow-sm border border-amber-100">⏰</div>
            <span className="text-slate-300 group-hover:text-amber-500 transition-colors">↗</span>
          </div>
          <div className="mt-3">
            <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">สาย / ออกก่อน</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-500">{stats.lateToday}</span>
              <span className="text-xs font-medium text-slate-400">คน</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 text-7xl opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-300 pointer-events-none">⏰</div>
        </Link>

        <Link href="/attendance" className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-rose-300 hover:-translate-y-1 transition-all group block">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-xl shadow-sm border border-rose-100">❌</div>
            <span className="text-slate-300 group-hover:text-rose-500 transition-colors">↗</span>
          </div>
          <div className="mt-3">
            <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">ขาดงาน</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-500">{stats.absentToday}</span>
              <span className="text-xs font-medium text-slate-400">คน</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 text-7xl opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-300 pointer-events-none">❌</div>
        </Link>

        <Link href="/leaves" className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 hover:-translate-y-1 transition-all group block">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shadow-sm border border-blue-100">🏖️</div>
            <span className="text-slate-300 group-hover:text-blue-500 transition-colors">↗</span>
          </div>
          <div className="mt-3">
            <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">ลางาน</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-blue-500">{stats.onLeaveToday}</span>
              <span className="text-xs font-medium text-slate-400">คน</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 text-7xl opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-300 pointer-events-none">🏖️</div>
        </Link>

        <Link href="/ot" className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-purple-300 hover:-translate-y-1 transition-all group block">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl shadow-sm border border-purple-100">💸</div>
            <span className="text-slate-300 group-hover:text-purple-500 transition-colors">↗</span>
          </div>
          <div className="mt-3">
            <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">ทำโอที {isToday ? 'วันนี้' : 'วันนั้น'}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-600">{stats.otToday}</span>
              <span className="text-xs font-medium text-slate-400">คน</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 text-7xl opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-300 pointer-events-none">💸</div>
        </Link>

      </div>

      {/* --- ส่วนที่ 2: กราฟ (Data Visualization) และ ฟีดความเคลื่อนไหว --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-4">สัดส่วนสถานะพนักงาน {isToday ? 'วันนี้' : 'วันนั้น'}</h2>
          <div className="h-48 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูล</div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 mb-4">จำนวนคนมาทำงาน 7 วันย้อนหลัง (นับจาก {displayDate})</h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="มาทำงาน" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- ส่วนที่ 3: ตารางรายชื่อ Actionable (รายการที่ต้องจัดการ) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-800">⚠️ รายชื่อ สาย / ออกก่อน / ขาดงาน</h2>
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">{lateAbsentList.length} รายการ</span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {lateAbsentList.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4">ยอดเยี่ยม! ไม่มีพนักงานสายหรือขาดในวันนี้</p>
            ) : (
              lateAbsentList.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{item.user?.first_name} {item.user?.last_name}</div>
                    <div className="text-xs text-slate-500">{item.user?.department || 'ไม่ระบุแผนก'}</div>
                  </div>
                  {item.type === 'late_early' ? (
                    <div className="text-right flex flex-col items-end gap-1">
                      {item.lateMins > 0 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">เข้าสาย {item.lateMins} นาที</span>}
                      {item.earlyMins > 0 && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">ออกก่อน {item.earlyMins} นาที</span>}
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">ขาดงาน</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-800">📑 รอดำเนินการด่วน (ล่าสุด)</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{stats.pendingLeaves + stats.pendingOTs} รายการ</span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {pendingApprovals.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4">ไม่มีรายการรออนุมัติ</p>
            ) : (
              pendingApprovals.map((req, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{req.users?.first_name} {req.users?.last_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {req.reqType === 'leave' ? (
                        <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">ยื่นลา: {req.leave_type}</span>
                      ) : (
                        <span className="text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">ขอ OT: {req.start_time?.substring(0,5)}-{req.end_time?.substring(0,5)}</span>
                      )}
                    </div>
                  </div>
                  <Link 
                    href={req.reqType === 'leave' ? '/leaves' : '/ot'} 
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
                  >
                    ตรวจสอบ
                  </Link>
                </div>
              ))
            )}
          </div>
          {(stats.pendingLeaves + stats.pendingOTs > 5) && (
             <div className="mt-3 text-center">
                <span className="text-xs text-slate-400 font-medium">มีรายการอื่นอีก รอดำเนินการในหน้าจัดการ</span>
             </div>
          )}
        </div>

        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm lg:col-span-1 text-slate-200">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            {isToday && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
            ความเคลื่อนไหว
          </h2>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
            {activityFeed.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-4">ไม่มีความเคลื่อนไหวในระบบสำหรับวันที่เลือก</p>
            ) : (
              activityFeed.map((act, idx) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <div className="text-slate-400 font-mono text-xs pt-0.5 whitespace-nowrap">
                    {new Date(act.time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </div>
                  <div>
                    {act.type === 'check_in' ? (
                      <span><span className="text-emerald-400 font-bold">{act.name}</span> ตอกบัตรเข้างาน</span>
                    ) : (
                      <span><span className="text-rose-400 font-bold">{act.name}</span> ตอกบัตรออกงาน</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}