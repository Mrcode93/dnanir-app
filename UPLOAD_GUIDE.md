# 📤 دليل رفع التطبيق إلى Expo

## خيارات الرفع:

### 1️⃣ **Expo Updates (OTA Updates)** - للتحديثات السريعة
تحديثات Over-The-Air للتطبيق بدون إعادة نشر على المتاجر

### 2️⃣ **EAS Build** - لبناء التطبيق للنشر
بناء APK/IPA للتطبيق لنشره على المتاجر

---

## 🚀 الطريقة 1: نشر تحديثات OTA (Expo Updates)

### الخطوات:

#### 1. تأكد من تثبيت EAS CLI
```bash
npm install -g eas-cli
```

#### 2. تسجيل الدخول
```bash
eas login
```

#### 3. إنشاء ملف EAS Update (إذا لم يكن موجوداً)
```bash
eas update:configure
```

#### 4. نشر التحديث
```bash
# للنشر على جميع القنوات
eas update --branch production --message "تحديث جديد - إصلاحات وتحسينات"

# أو للنشر على قناة محددة
eas update --branch preview --message "تحديث تجريبي"
```

#### 5. فحص التحديثات المنشورة
```bash
eas update:list
```

---

## 🏗️ الطريقة 2: بناء التطبيق (EAS Build)

### بناء APK/IPA:

#### 1. تسجيل الدخول (إذا لم تكن مسجل الدخول)
```bash
eas login
```

#### 2. بناء لتطبيق Android (APK/AAB)
```bash
# للاختبار (APK)
eas build --platform android --profile preview

# للإنتاج (AAB للـ Google Play)
eas build --platform android --profile production
```

#### 3. بناء لتطبيق iOS (IPA)
```bash
# للاختبار
eas build --platform ios --profile preview

# للإنتاج (لـ App Store)
eas build --platform ios --profile production
```

#### 4. بناء لكلا المنصتين
```bash
eas build --platform all --profile production
```

#### 5. تتبع حالة البناء
```bash
eas build:list
```

---

## 📱 الطريقة 3: رفع مباشر للمتاجر (EAS Submit)

### رفع Android إلى Google Play:

```bash
# بعد اكتمال البناء
eas submit --platform android --profile production
```

**ملاحظة:** تحتاج إلى ملف `serviceAccountKeyPath` في `eas.json`

### رفع iOS إلى App Store:

```bash
# بعد اكتمال البناء
eas submit --platform ios --profile production
```

---

## 📋 ملفات الإعداد المطلوبة:

### 1. `eas.json` (موجود ✅)
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### 2. `app.json` (محدث ✅)
- ✅ الاسم: "دنانير"
- ✅ الأيقونة: logo.png
- ✅ Bundle ID/Package: com.mrcodeiq.dinar

---

## 🔑 خطوات أولية (مرة واحدة):

### 1. إنشاء حساب Expo
```bash
# زيارة الموقع وإنشاء حساب
# https://expo.dev
```

### 2. تثبيت EAS CLI
```bash
npm install -g eas-cli
```

### 3. تسجيل الدخول
```bash
eas login
```

### 4. ربط المشروع
```bash
cd /Users/amerahmed/Desktop/dnanir-app
eas init
```

---

## 📝 أوامر سريعة:

### للاختبار السريع (Preview):
```bash
# Android APK
eas build --platform android --profile preview

# سيتم إنشاء رابط تحميل
```

### للإنتاج (Production):
```bash
# بناء كامل
eas build --platform all --profile production

# ثم رفع للمتاجر
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

### لنشر تحديث OTA:
```bash
eas update --branch production --message "تحديث جديد"
```

---

## ⚙️ إعدادات المتاجر:

### Google Play Store:
- اسم التطبيق: **"دنانير"**
- الوصف: **"تطبيق دنانير - تطبيقك الذكي لإدارة الأموال"**
- Package: `com.mrcodeiq.dinar`
- Version Code: 1 (سيتم زيادته تلقائياً)

### Apple App Store:
- اسم التطبيق: **"دنانير"**
- Display Name: **"دنانير"**
- Bundle ID: `com.mrcodeiq.dinar`
- Build Number: 1 (سيتم زيادته تلقائياً)

---

## 🎯 الخطوات الموصى بها:

### 1. اختبار محلي أولاً:
```bash
npm start
# اختبر التطبيق في Expo Go
```

### 2. بناء Preview:
```bash
eas build --platform android --profile preview
# احصل على APK للاختبار
```

### 3. نشر تحديث OTA (اختياري):
```bash
eas update --branch preview --message "تحديث تجريبي"
```

### 4. بناء Production:
```bash
eas build --platform all --profile production
```

### 5. رفع للمتاجر:
```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

---

## 🔍 فحص الحالة:

```bash
# عرض جميع البناءات
eas build:list

# عرض جميع التحديثات
eas update:list

# عرض معلومات المشروع
eas project:info
```

---

## ❗ متطلبات إضافية:

### للـ iOS (App Store):
- ✅ Apple Developer Account (99$ سنوياً)
- ✅ شهادات التوقيع (سيتم إنشاؤها تلقائياً)
- ✅ Provisioning Profiles (سيتم إنشاؤها تلقائياً)

### للـ Android (Google Play):
- ✅ Google Play Developer Account (25$ مرة واحدة)
- ✅ Service Account Key (للتقديم التلقائي)
- ✅ ملف موجود في `eas.json`: `dnanir-app-e69e13cbbdc0.json`

---

## 🆘 استكشاف الأخطاء:

### خطأ: "Not authenticated"
```bash
eas login
```

### خطأ: "Project not initialized"
```bash
eas init
```

### خطأ: "Build failed"
- تحقق من `app.json` و `package.json`
- تحقق من أن جميع الملفات موجودة
- راجع logs: `eas build:list`

---

## 📚 روابط مفيدة:

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)

---

## ✅ قبل الرفع - قائمة التحقق:

- [ ] تم اختبار التطبيق محلياً
- [ ] جميع الأيقونات في مكانها (`logo.png`)
- [ ] الاسم العربي "دنانير" في `app.json`
- [ ] Bundle ID/Package صحيح
- [ ] تم تسجيل الدخول: `eas login`
- [ ] تم ربط المشروع: `eas init`
- [ ] الإعدادات في `eas.json` صحيحة

