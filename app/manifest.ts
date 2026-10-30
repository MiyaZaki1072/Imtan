import type { MetadataRoute } from 'next';

// Makes the app installable ("Add to Home Screen"); iPhone push only works once installed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'อิ่มทัน',
    short_name: 'อิ่มทัน',
    description: 'ดูคิวทุกร้าน สั่งอาหาร และรับแจ้งเตือนเมื่ออาหารพร้อม',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#C2410C',
    lang: 'th',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
