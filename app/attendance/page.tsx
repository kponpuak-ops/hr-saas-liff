'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AttendanceAdminPage() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [holidays, setHolidays] = useState<string[]>([])
  const [otRequests, setOtRequests] = useState<any[]>([])
  const [companyId, setCompanyId] = useState<number | null>(null)
  
  // State สำหรับ Dropdown พนักงานใน Modal
  const [usersList, setUsersList] = useState<any[]>([])
  
  // State สำหรับตัวกรอง (Filters)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [departments, setDepartments] = useState<string[]>([])

  // สำหรับ Popup ขยายรูป
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // State สำหรับ Modal เพิ่ม/แก้ไขเวลา
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    userId: '',
    actionDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
    checkInTime: '',
    checkOutTime: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userAuth } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_id', session.user.id)
        .single()

      if (!userAuth?.company_id) return
      setCompanyId(userAuth.company_id)

      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', userAuth.company_id)
        .single()
      setSettings(companySettings)

      const { data: empData } = await supabase
        .from('users')
        .select('id, first_name, last_name, employee_id, department')
        .eq('company_id', userAuth.company_id)
        .neq('role', 'super_admin')
      
      setUsersList(empData || [])
      
      if (empData) {
        const uniqueDepts = Array.from(new Set(empData.map(u => u.department).filter(Boolean)))
        setDepartments(uniqueDepts as string[])
      }

      const { data: holidaysData } = await supabase
        .from('company_holidays')
        .select('holiday_date')
        .eq('company_id', userAuth.company_id)
      setHolidays(holidaysData?.map(h => h.holiday_date) || [])

      const { data: otData } = await supabase
        .from('ot_requests')
        .select('*, users!user_id!inner(company_id)')
        .eq('users.company_id', userAuth.company_id)
        .eq('status', 'approved')
      setOtRequests(otData || [])

      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select(`
          *,
          users!inner (company_id, first_name, last_name, avatar_url, position, base_salary, daily_rate, department),
          work_shifts (shift_name, start_time, end_time, late_buffer_minutes, late_deduction_per_minute)
        `)
        .eq('users.company_id', userAuth.company_id)
        .order('action_date', { ascending: false })
        .order('id', { ascending: false })

      if (error) throw error
      setRecords(attendanceData || [])
    } catch (err: any) {
      console.error('Error fetching data:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.userId || !formData.actionDate || !formData.checkInTime) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วนอย่างน้อย วันที่, พนักงาน และ เวลาเข้างาน')
      return
    }

    setIsSaving(true)
    try {
      let lateMins = 0
      let earlyMins = 0
      let deductAmt = 0

      const checkInDateTime = new Date(`${formData.actionDate}T${formData.checkInTime}:00+07:00`)
      const expectedIn = new Date(`${formData.actionDate}T${settings?.default_start_time || '08:00'}:00+07:00`)
      const buffer = settings?.late_buffer_minutes || 0
      const maxAllowedIn = new Date(expectedIn.getTime() + (buffer * 60000))

      if (checkInDateTime > maxAllowedIn) {
        lateMins = Math.floor((checkInDateTime.getTime() - expectedIn.getTime()) / 60000)
      }

      let checkOutDateTime = null
      if (formData.checkOutTime) {
        checkOutDateTime = new Date(`${formData.actionDate}T${formData.checkOutTime}:00+07:00`)
        const expectedOut = new Date(`${formData.actionDate}T${settings?.default_end_time || '17:00'}:00+07:00`)
        if (checkOutDateTime < expectedOut) {
          earlyMins = Math.floor((expectedOut.getTime() - checkOutDateTime.getTime()) / 60000)
        }
      }

      const rate = settings?.late_deduction_per_minute || 0
      deductAmt = (lateMins + earlyMins) * rate

      const { data: existingRecord, error: checkError } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', formData.userId)
        .eq('action_date', formData.actionDate)
        .maybeSingle()

      if (checkError) throw checkError;

      if (existingRecord) {
        const { error: updateError } = await supabase.from('attendance').update({
          check_in_time: checkInDateTime.toISOString(),
          check_out_time: checkOutDateTime ? checkOutDateTime.toISOString() : null,
          late_minutes: lateMins,
          early_leave_minutes: earlyMins,
          deduction_amount: deductAmt,
          is_manual: true
        }).eq('id', existingRecord.id)
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('attendance').insert({
          company_id: companyId,
          user_id: formData.userId,
          action_date: formData.actionDate,
          check_in_time: checkInDateTime.toISOString(),
          check_out_time: checkOutDateTime ? checkOutDateTime.toISOString() : null,
          late_minutes: lateMins,
          early_leave_minutes: earlyMins,
          deduction_amount: deductAmt,
          is_manual: true
        })

        if (insertError) throw insertError;
      }

      alert('บันทึกข้อมูลเรียบร้อยแล้ว')
      setIsModalOpen(false)
      fetchData()
    } catch (error: any) {
      console.error('Save error:', error)
      alert('เกิดข้อผิดพลาด: ' + (error.message || JSON.stringify(error)))
    } finally {
      setIsSaving(false)
    }
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null
    const R = 6371e3
    const p1 = lat1 * Math.PI/180
    const p2 = lat2 * Math.PI/180
    const dp = (lat2-lat1) * Math.PI/180
    const dl = (lon2-lon1) * Math.PI/180
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return Math.round(R * c)
  }

  const timeToMins = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  const calculateOTForRecord = (record: any) => {
    const otReq = otRequests.find(ot => ot.user_id === record.user_id && ot.request_date === record.action_date);
    if (!otReq || !record.check_out_time || !record.check_in_time || !settings) return { hours: 0, amount: 0, isHoliday: false };

    const isHoliday = holidays.includes(record.action_date);
    const shiftInfo = record.work_shifts;

    const useShift = settings.has_shifts;
    const normStartStr = useShift && shiftInfo ? shiftInfo.start_time : settings.default_start_time;
    const normEndStr = useShift && shiftInfo ? shiftInfo.end_time : settings.default_end_time;
    const normStart = timeToMins(normStartStr);
    const normEnd = timeToMins(normEndStr);

    const otReqStart = timeToMins(otReq.start_time);
    const otReqEnd = timeToMins(otReq.end_time);

    const checkInDate = new Date(record.check_in_time);
    const checkOutDate = new Date(record.check_out_time);
    const attStart = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    const attEnd = checkOutDate.getHours() * 60 + checkOutDate.getMinutes();

    let actualAttEnd = attEnd < attStart ? attEnd + 1440 : attEnd;
    let actualOtReqEnd = otReqEnd < otReqStart ? otReqEnd + 1440 : otReqEnd;
    let actualNormEnd = normEnd < normStart ? normEnd + 1440 : normEnd;

    const validStart = Math.max(otReqStart, attStart);
    const validEnd = Math.min(actualOtReqEnd, actualAttEnd);
    if (validStart >= validEnd) return { hours: 0, amount: 0, isHoliday };
    const totalValidMins = validEnd - validStart;

    const inStart = Math.max(validStart, normStart);
    const inEnd = Math.min(validEnd, actualNormEnd);
    let insideMins = inStart < inEnd ? inEnd - inStart : 0;
    const outsideMins = totalValidMins - insideMins;

    const insideHours = insideMins / 60;
    const outsideHours = outsideMins / 60;

    const baseSalary = record.users?.base_salary || 0;
    const dailyRate = record.users?.daily_rate || (baseSalary / 30);
    const hourlyRate = dailyRate / 8;

    let totalAmount = 0;
    let totalHours = 0;

    if (isHoliday) {
        totalAmount = (insideHours * hourlyRate * (settings.ot_rate_holiday_work ?? 2.0)) + 
                      (outsideHours * hourlyRate * (settings.ot_rate_holiday_ot ?? 3.0));
        totalHours = insideHours + outsideHours;
    } else {
        totalHours = insideHours + outsideHours;
        totalAmount = totalHours * hourlyRate * (settings.ot_rate_normal ?? 1.5);
    }

    return { hours: totalHours, amount: totalAmount, isHoliday };
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)
  }

  // ระบบกรองข้อมูล
  const filteredRecords = records.filter(record => {
    let match = true;
    if (searchQuery) {
      const fullName = `${record.users?.first_name} ${record.users?.last_name}`.toLowerCase();
      if (!fullName.includes(searchQuery.toLowerCase())) match = false;
    }
    if (filterDept !== 'all' && record.users?.department !== filterDept) match = false;
    if (startDate && record.action_date < startDate) match = false;
    if (endDate && record.action_date > endDate) match = false;
    return match;
  });

  // 💡 ประมวลผลข้อมูลสรุป (Summary) จากรายการที่กรองแล้ว
  const summaryData = filteredRecords.reduce((acc, record) => {
    acc.lateMins += record.late_minutes || 0;
    acc.earlyMins += record.early_leave_minutes || 0;
    acc.deduction += record.deduction_amount || 0;
    
    const ot = calculateOTForRecord(record);
    acc.otHours += ot.hours;
    acc.otAmount += ot.amount;
    
    acc.uniqueUsers.add(record.user_id);
    return acc;
  }, { lateMins: 0, earlyMins: 0, deduction: 0, otHours: 0, otAmount: 0, uniqueUsers: new Set() });

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    let csvContent = '\uFEFF'; 
    csvContent += 'วันที่,พนักงาน,แผนก,เวลาเข้า,เวลาออก,สาย (นาที),ออกก่อน (นาที),หักเงิน (บาท),OT (ชม.),OT (บาท),รูปแบบ\n';

    filteredRecords.forEach(record => {
      const date = new Date(record.action_date).toLocaleDateString('th-TH');
      const name = `${record.users?.first_name || ''} ${record.users?.last_name || ''}`;
      const dept = record.users?.department || '-';
      const timeIn = record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
      const timeOut = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
      const late = record.late_minutes || 0;
      const early = record.early_leave_minutes || 0;
      const deduct = record.deduction_amount || 0;
      
      const otResult = calculateOTForRecord(record);
      const otHours = otResult.amount > 0 ? otResult.hours.toFixed(2) : '0';
      const otAmount = otResult.amount > 0 ? otResult.amount.toFixed(2) : '0';
      const isManual = record.is_manual ? 'HR แก้ไข' : 'สแกนปกติ';

      csvContent += `"${date}","${name}","${dept}","${timeIn}","${timeOut}","${late}","${early}","${deduct}","${otHours}","${otAmount}","${isManual}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_export_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ประวัติการลงเวลา (Attendance)</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {settings?.has_shifts ? '🏢 โหมด: ระบบมีกะ (Multi-Shift)' : '🏢 โหมด: เวลามาตรฐาน'} 
              {settings?.require_photo && ' • 📸 บังคับถ่ายรูป'}
              {settings?.location_lat && ` • 📍 รัศมี GPS ${settings.location_radius}ม.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow text-sm font-medium transition flex items-center gap-2"
            >
              📝 เพิ่ม/แก้ไขเวลา
            </button>
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow text-sm font-medium transition flex items-center gap-2"
            >
              📥 ส่งออก Excel (CSV)
            </button>
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterDept('all');
                setStartDate('');
                setEndDate('');
                fetchData();
              }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm text-sm font-medium transition flex items-center gap-2"
            >
              🔄 รีเฟรชข้อมูล
            </button>
          </div>
        </div>

        {/* กล่องตัวกรองค้นหา (Filter Bar) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">🔍 ค้นหาพนักงาน</label>
            <input 
              type="text" 
              placeholder="พิมพ์ชื่อ หรือ นามสกุล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500"
            />
          </div>
          
          <div className="md:w-48">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">🏢 กรองตามแผนก</label>
            <select 
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">ทุกแผนก</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="md:w-40">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">📅 ตั้งแต่วันที่</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:w-40">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">📅 ถึงวันที่</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* 💡 แถบสรุปข้อมูล (Dynamic Summary Bar) */}
        {filteredRecords.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">รายการทั้งหมดที่พบ</div>
              <div className="text-2xl font-black text-slate-800">{filteredRecords.length} <span className="text-sm font-bold text-slate-500">รายการ</span></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">พนักงาน (ไม่ซ้ำ)</div>
              <div className="text-2xl font-black text-indigo-600">{summaryData.uniqueUsers.size} <span className="text-sm font-bold text-indigo-400">คน</span></div>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-sm flex flex-col justify-center">
              <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">สาย/ออกก่อน (หักเงิน)</div>
              <div className="text-2xl font-black text-rose-700">{formatMoney(summaryData.deduction)} <span className="text-sm font-bold text-rose-500">฿</span></div>
              <div className="text-[10px] text-rose-500 font-semibold mt-0.5">รวมสาย/ออกก่อน {summaryData.lateMins + summaryData.earlyMins} นาที</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">OT รวม (จ่ายเพิ่ม)</div>
              <div className="text-2xl font-black text-emerald-700">{formatMoney(summaryData.otAmount)} <span className="text-sm font-bold text-emerald-500">฿</span></div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">อนุมัติรวม {summaryData.otHours.toFixed(2)} ชม.</div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-4 font-semibold">วันที่</th>
                  <th className="px-4 py-4 font-semibold">พนักงาน</th>
                  <th className="px-4 py-4 font-semibold text-center">เวลาเข้า / สถานที่</th>
                  <th className="px-4 py-4 font-semibold text-center">เวลาออก / สถานที่</th>
                  <th className="px-4 py-4 font-semibold text-center">รูปถ่ายยืนยัน</th>
                  <th className="px-4 py-4 font-semibold text-right text-rose-600">สาย / ออกก่อน / หักเงิน</th>
                  <th className="px-4 py-4 font-semibold text-right text-emerald-600">OT ที่ทำได้จริง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">กำลังโหลดข้อมูล...</td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">ไม่พบประวัติการลงเวลาตามที่ค้นหา</td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const otResult = calculateOTForRecord(record)
                    const distIn = calculateDistance(settings?.location_lat, settings?.location_lng, record.check_in_lat, record.check_in_lng)
                    const distOut = calculateDistance(settings?.location_lat, settings?.location_lng, record.check_out_lat, record.check_out_lng)

                    return (
                      <tr key={record.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-4">
                          {new Date(record.action_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          {record.work_shifts && (
                             <div className="text-[10px] text-purple-600 font-bold mt-1">กะ: {record.work_shifts.shift_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                              {record.users?.avatar_url ? (
                                <img src={record.users.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                record.users?.first_name?.[0] || '👤'
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">
                                {record.users?.first_name} {record.users?.last_name}
                                {record.is_manual && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">HR แก้ไข</span>}
                              </p>
                              <p className="text-xs text-slate-500">{record.users?.department ? `${record.users.department} • ` : ''}{record.users?.position || 'พนักงาน'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {record.check_in_time ? (
                            <div className="flex flex-col items-center">
                              <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded text-sm">
                                {new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {record.check_in_lat && record.check_in_lng && (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${record.check_in_lat},${record.check_in_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline mt-1 flex items-center gap-1 font-medium transition"
                                >
                                  📍 {distIn !== null ? `ห่าง ${distIn} ม.` : 'ดูพิกัดบนแผนที่'}
                                </a>
                              )}
                            </div>
                          ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {record.check_out_time ? (
                            <div className="flex flex-col items-center">
                              <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded text-sm">
                                {new Date(record.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {record.check_out_lat && record.check_out_lng && (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${record.check_out_lat},${record.check_out_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline mt-1 flex items-center gap-1 font-medium transition"
                                >
                                  📍 {distOut !== null ? `ห่าง ${distOut} ม.` : 'ดูพิกัดบนแผนที่'}
                                </a>
                              )}
                            </div>
                          ) : <span className="text-amber-500 text-xs font-semibold bg-amber-50 px-2 py-1 rounded">กำลังปฏิบัติงาน</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            {record.check_in_image ? (
                              <img src={record.check_in_image} alt="In" onClick={() => setPreviewImage(record.check_in_image)} className="w-10 h-10 rounded border border-slate-200 object-cover cursor-pointer hover:opacity-80 shadow-sm" title="ภาพตอนเข้างาน" />
                            ) : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">IN</div>}
                            
                            {record.check_out_image ? (
                              <img src={record.check_out_image} alt="Out" onClick={() => setPreviewImage(record.check_out_image)} className="w-10 h-10 rounded border border-slate-200 object-cover cursor-pointer hover:opacity-80 shadow-sm" title="ภาพตอนออกงาน" />
                            ) : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">OUT</div>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {record.deduction_amount > 0 ? (
                            <div className="flex flex-col items-end">
                              {record.late_minutes > 0 && <span className="text-rose-600 text-[11px] font-medium">สาย {record.late_minutes} นาที</span>}
                              {record.early_leave_minutes > 0 && <span className="text-rose-600 text-[11px] font-medium">ออกก่อน {record.early_leave_minutes} นาที</span>}
                              <span className="text-rose-800 font-bold mt-0.5">-{formatMoney(record.deduction_amount)} ฿</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {otResult.amount > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className={`text-[10px] font-bold px-1.5 rounded ${otResult.isHoliday ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {otResult.hours.toFixed(2)} ชม. ({otResult.isHoliday ? 'วันหยุด' : 'ปกติ'})
                              </span>
                              <span className="text-emerald-600 font-bold mt-1">+{formatMoney(otResult.amount)} ฿</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- Modal Window สำหรับ HR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 text-lg">📝 เพิ่ม/แก้ไขเวลาตอกบัตร</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleManualSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">พนักงาน</label>
                <select 
                  required
                  value={formData.userId}
                  onChange={(e) => setFormData({...formData, userId: e.target.value})}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500"
                >
                  <option value="">-- เลือกพนักงาน --</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">วันที่ทำงาน</label>
                <input 
                  type="date" required
                  value={formData.actionDate}
                  onChange={(e) => setFormData({...formData, actionDate: e.target.value})}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">เวลาเข้างาน</label>
                  <input 
                    type="time" required
                    value={formData.checkInTime}
                    onChange={(e) => setFormData({...formData, checkInTime: e.target.value})}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">เวลาออกงาน</label>
                  <input 
                    type="time"
                    value={formData.checkOutTime}
                    onChange={(e) => setFormData({...formData, checkOutTime: e.target.value})}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">ปล่อยว่างได้หากยังไม่เลิกงาน</p>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full">
            <button className="absolute -top-10 right-0 text-white font-bold text-xl" onClick={() => setPreviewImage(null)}>✕ ปิด</button>
            <img src={previewImage} alt="Preview" className="w-full h-auto rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  )
}