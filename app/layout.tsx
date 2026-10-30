import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

const plexThai = IBM_Plex_Sans_Thai({
  variable: '--font-plex-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  icons: { apple: '/icons/apple-180.png' },
  title: 'อิ่มทัน',
  description:
    'ดูคิวทุกร้าน สั่งอาหาร และรับแจ้งเตือนเมื่ออาหารพร้อม · โรงอาหารคณะวิศวกรรมศาสตร์ จุฬาฯ',
};

export const viewport: Viewport = {
  themeColor: '#C2410C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th" className={`${plexThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
