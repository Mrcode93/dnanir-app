# 🚀 رفع سريع للتطبيق

## الخطوات السريعة:

### 1️⃣ **تسجيل الدخول (مرة واحدة فقط)**
```bash
cd /Users/amerahmed/Desktop/dnanir-app
eas login
```

### 2️⃣ **ربط المشروع (مرة واحدة فقط)**
```bash
eas init
# اتبع التعليمات - استخدم Project ID الموجود: 286a1138-789a-48d6-9925-e0dc64b24ee1
```

### 3️⃣ **بناء التطبيق للاختبار**
```bash
# لـ Android (APK للاختبار)
eas build --platform android --profile preview

# أو لـ iOS (للاختبار)
eas build --platform ios --profile preview
```

### 4️⃣ **بناء التطبيق للإنتاج**
```bash
# لبناء كامل لكلا المنصتين
eas build --platform all --profile production
```

### 5️⃣ **نشر تحديث OTA (تحديثات سريعة بدون رفع للمتاجر)**
```bash
eas update --branch production --message "تحديث جديد"
```

### 6️⃣ **رفع للمتاجر (بعد اكتمال البناء)**
```bash
# Android → Google Play
eas submit --platform android --profile production

# iOS → App Store
eas submit --platform ios --profile production
```

---

## 📋 أوامر مفيدة:

```bash
# عرض حالة البناءات
eas build:list

# عرض التحديثات المنشورة
eas update:list

# معلومات المشروع
eas project:info

# تحديث EAS CLI
npm install -g eas-cli@latest
```

---

## 🎯 الاختيار السريع:

### ✅ أريد تحديث التطبيق بسرعة (OTA Updates):
```bash
eas update --branch production --message "تحديث جديد"
```

### ✅ أريد بناء APK/IPA للاختبار:
```bash
eas build --platform android --profile preview
```

### ✅ أريد بناء للإنتاج والرفع للمتاجر:
```bash
eas build --platform all --profile production
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

---

## ⚡ ابدأ الآن:

```bash
cd /Users/amerahmed/Desktop/dnanir-app
eas login
eas build --platform android --profile preview
```

سيتم إرسال رابط تحميل APK بعد اكتمال البناء! 📱

