# FocusBoard

แอปจัดการงานส่วนตัว — sync ข้ามอุปกรณ์แบบ Real-time

## A. สร้าง Firebase Project

1. ไปที่ [console.firebase.google.com](https://console.firebase.google.com)
2. คลิก **Add project** → ตั้งชื่อ → Create
3. ไปที่ **Firestore Database** → Create database → เลือก **Production mode** → Next → Enable
4. ไปที่ **Authentication** → Get started → Sign-in method → เปิด **Anonymous** → Save
5. ไปที่ **Project Settings** (เฟือง) → Your apps → เพิ่ม Web app `</>` → ลงทะเบียน → คัดลอก `firebaseConfig`

### Firestore Security Rules (สำคัญ!)

ไปที่ Firestore → Rules → วางข้อความนี้ → Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## B. ใส่ credentials

```bash
cp firebase-config.example.js firebase-config.js
# แก้ไขค่าใน firebase-config.js ด้วย config จาก Firebase Console
```

## C. GitHub Pages

1. Push โค้ดขึ้น GitHub repo (public หรือ private ก็ได้)
2. ไปที่ repo → **Settings** → **Pages**
3. Source: **Deploy from a branch** → Branch: `main` → folder: `/ (root)` → Save
4. รอ ~60 วินาที แล้วเปิด URL ที่แสดง

## D. ใช้งาน

- เปิด URL บน PC และสมาร์ทโฟน
- บน Android Chrome: แตะ ⋮ → **Add to Home screen**
- บน iOS Safari: แตะ Share → **Add to Home Screen**
- ข้อมูลจะ sync ระหว่างอุปกรณ์ทันที

## Tech Stack

- HTML5 + CSS3 (no framework)
- Vanilla JS (ES Modules)
- Firebase Firestore (real-time database)
- Firebase Auth (anonymous)
- GitHub Pages (hosting)
- PWA (installable)
