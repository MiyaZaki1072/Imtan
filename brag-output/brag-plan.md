# /brag plan: อิ่มทัน (Imtan)

**What it is:** A queue + ordering web app for the Chulalongkorn Engineering canteen (iCanteen).
Students see every shop's live queue and wait time, order and pay from their phone, and get an
alert when the food is ready. Vendors run every order from one live board.

**For whom:** Students on a 12:00 lunch rush, and the canteen vendors.
**What sets it apart:** Wait time counted per dish, not per order. Scan the QR at the shop, with no app to install.
The vendor board puts every order in one place, so nothing is forgotten.
**Hook:** "12:00. Five shops. Which queue is shortest?" The answer shows up instantly as real busy pills.
**Share caption:** "Stop guessing which canteen line is shortest."

**Tone:** default (punchy, playful, clean). Landscape 1920×1080, 30 fps, 20 s.
**Visual identity (from `app/globals.css`):** bg `#faf8f5`, primary `#c2410c`, ink `#1c1b1a`,
success `#15803d`, warning `#b45309` / `#fef3c7`, danger `#b91c1c`, IBM Plex Sans Thai, rounded-2xl cards.
**Music:** "Happy Beats / Business Moves Vol. 1" (Sascha Ende, CC BY 4.0), 120 BPM, started at
3.02 s, so the beats land on 0, 0.5, 1.0 … s of video time. Every cut falls on a 2 s bar line.

## Storyboard

| # | Time | Scene | On screen | SFX |
|---|---|---|---|---|
| 1 | 0–2 s | Hook | "12:00." slams in; the 5 real shop names stack in with "?" | soft clicks per name, on beats |
| 2 | 2–4 s | Reveal | The "?"s flip into real busy pills (แน่น / ปานกลาง / ว่าง); "อิ่มทัน knows." | switch on 2.0 |
| 3 | 4–8 s | Live queues | Phone: real home screen (`HomeLive` + `ShopRow`); queue counts tick. Caption: "See every shop's queue & wait time, live." | — |
| 4 | 8–12 s | Order | Phone: ไก่กรอบ ซอย 9 พี่ส้ม → tap ข้าวราด (ไก่กรอบ + ไข่ข้น ฿60) → pay → QueueTicket **ส้ม-27 · ~6 นาที**. Caption: "Order & pay from your phone. Skip the line." | taps on beats |
| 5 | 12–16 s | Vendor | Tablet: real VendorBoard columns รอทำ / กำลังทำ / พร้อมรับ; ส้ม-27 moves through them on taps. Caption: "Vendors: every order on one board. Nothing forgotten." | click + drop |
| 6 | 16–18 s | Ready | Phone turns green (`ReadyAlert`): "อาหารพร้อมแล้ว! ส้ม-27". Caption: "Food's ready? Your phone tells you." | bong |
| 7 | 18–20 s | Outro | อิ่มทัน + "Scan the QR at the shop. No app to install." + "Chula Engineering canteen" | — |

Total: 20 s.

## Notes
- The UI is rebuilt from the real components' Tailwind classes and Thai copy. The app needs a live Supabase backend, so it can't be rendered standalone.
- Customer names on the vendor board are made up (ต้น, มิว, แบม, โอ๊ต). Queue numbers and wait times are illustrative but follow the app's rules
  (ว่าง < 5 min ≤ ปานกลาง ≤ 12 min < แน่น).
