'use client'

export default function ExportButton({ data }: { data: any[] }) {
  const handleExport = () => {
    // กำหนดหัวคอลัมน์
    const headers = ['วันที่', 'ชื่อ', 'นามสกุล', 'ตำแหน่ง', 'เวลาเข้างาน', 'เวลาออกงาน']
    
    // จัดรูปแบบข้อมูลแต่ละแถว
    const csvRows = data.map(record => {
      const date = new Date(record.action_date).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })
      const inTime = record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'
      const outTime = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'
      
      // ครอบข้อมูลด้วย "" เพื่อป้องกัน Error กรณีมีเครื่องหมายลูกน้ำในข้อความ
      return [
        date,
        record.users?.first_name || '',
        record.users?.last_name || '',
        record.users?.role || '',
        inTime,
        outTime
      ].map(field => `"${field}"`).join(',')
    })

    // รวมหัวคอลัมน์และข้อมูล (\uFEFF คือ BOM ช่วยให้โปรแกรม Excel อ่านภาษาไทยได้ไม่เพี้ยน)
    const csvContent = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    
    // สร้างลิงก์จำลองเพื่อกดดาวน์โหลดอัตโนมัติ
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const todayStr = new Date().toISOString().split('T')[0]
    link.setAttribute('download', `ประวัติลงเวลา_${todayStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <button 
      onClick={handleExport}
      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
    >
      <span>📥</span> ดาวน์โหลด Excel (CSV)
    </button>
  )
}