import type { Metadata } from "next";
import "./globals.css";
import NavigationLayout from "./components/NavigationLayout"; // นำเข้า Sidebar ที่เราสร้าง

export const metadata: Metadata = {
  title: 'APro HR SaaS', // 💡 เปลี่ยนจาก 'HR SaaS' เป็นชื่อนี้
  description: 'ระบบจัดการทรัพยากรบุคคล',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>
        {/* เอา NavigationLayout มาครอบ children เพื่อให้ทุกหน้ามีเมนู (ยกเว้นหน้า LIFF) */}
        <NavigationLayout>
          {children}
        </NavigationLayout>
      </body>
    </html>
  );
}