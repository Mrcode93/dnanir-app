# دليل البناء المحلي (Local Build Guide)

## بناء iOS في Xcode

لتحضير المشروع وفتحه في Xcode:

### 1. تثبيت الاعتماديات وتوليد مشروع iOS
```bash
npm install
npm run ios:prebuild
```
أو استخدم السكربت الجاهز (يفعل الاثنين + CocoaPods):
```bash
npm run ios:setup
```

### 2. تثبيت CocoaPods (إذا لم تستخدم ios:setup)
```bash
cd ios && pod install && cd ..
```

### 3. فتح المشروع في Xcode
**افتح ملف الـ workspace وليس الـ project:**
```bash
open ios/dnanyr.xcworkspace
```
أو من Xcode: File → Open → اختر المجلد `ios` ثم الملف `dnanyr.xcworkspace`.

### 4. في Xcode
- اختر **Signing & Capabilities** → حدد **Team** (حساب Apple Developer).
- اختر جهاز أو محاكي ثم: **Product → Run** (أو Cmd+R).

**ملاحظة:** إذا غيرت `app.json` أو أضفت/عدّلت إضافات native، أعد التشغيل:
```bash
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```

---

## بناء أندرويد محلياً (بدون سيرفرات Expo)

### المتطلبات الأساسية
1. **Java JDK 17**: مثبت (مثلاً عبر Homebrew).
2. **Android SDK**: موجود على النظام.
3. **مجلد `android`**: يُولَّد عبر `npx expo prebuild --platform android`.

---

## بناء AAB لرفعه على Google Play Store

ملف **AAB** (Android App Bundle) هو المطلوب للنشر على Play Store (وليس APK فقط).

### 1. توليد مشروع أندرويد (إذا لم يكن موجوداً)
```bash
npm install
npm run android:prebuild
```

### 2. إعداد المتغيرات
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
```
*(عدّل مسار `JAVA_HOME` إذا كان تثبيت الجافا لديك مختلفاً.)*

### 3. إعداد التوقيع (Release signing)

**تم إعداد التوقيع مسبقاً:** يوجد keystore عند `android/app/dnanir-release.keystore` وكلمة المرور الافتراضية `dnanirrelease` مضبوطة في `android/gradle.properties`. يمكنك تغيير كلمة المرور لاحقاً للنشر الرسمي.

إذا أردت إنشاء keystore جديد بنفسك (مرة واحدة فقط – احفظ الملف وكلمة المرور):
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/dnanir-release.keystore -alias dnanir -keyalg RSA -keysize 2048 -validity 10000
```

**ب) إنشاء/تعديل `android/gradle.properties`** وأضف (لا ترفع هذا الملف إذا كان فيه كلمات سر إلى Git):
```properties
DNANIR_RELEASE_STORE_FILE=dnanir-release.keystore
DNANIR_RELEASE_KEY_ALIAS=dnanir
DNANIR_RELEASE_STORE_PASSWORD=كلمة_السر
DNANIR_RELEASE_KEY_PASSWORD=كلمة_السر
```

**ج)** تأكد أن `android/app/build.gradle` يستخدم هذه المتغيرات في `signingConfigs.release`. إذا لم يكن مضبوطاً، يمكن إضافة شيء مثل:
```groovy
signingConfigs {
    release {
        if (project.hasProperty('DNANIR_RELEASE_STORE_FILE')) {
            storeFile file(DNANIR_RELEASE_STORE_FILE)
            storePassword DNANIR_RELEASE_STORE_PASSWORD
            keyAlias DNANIR_RELEASE_KEY_ALIAS
            keyPassword DNANIR_RELEASE_KEY_PASSWORD
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        // ...
    }
}
```
### 4. بناء ملف APK
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
npm run build:android:apk

### 3.1 الحصول على بصمة SHA-1 (Certificate fingerprint)

مطلوبة غالباً لإعداد **Firebase** أو **Google Sign-In** أو **Google APIs** في وحدة التحكم (Console).

**أ) SHA-1 للتطوير (Debug)**  
يُستخدم أثناء التطوير. الـ keystore الافتراضي يُنشأ عند أول تشغيل أو بناء أندرويد. إن لم يكن موجوداً، شغّل المشروع مرة واحدة ثم نفّذ:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

ابحث في المخرجات عن السطر **SHA1:** وانسخ القيمة (مثل `AA:BB:CC:...`).

**ب) SHA-1 للإصدار (Release)**  
بعد إنشاء مجلد `android` وملف الـ keystore (مثلاً `android/app/dnanir-release.keystore`):

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
keytool -list -v -keystore android/app/dnanir-release.keystore -alias dnanir
```

أدخل كلمة مرور الـ keystore عند الطلب، ثم انسخ قيمة **SHA1:** من المخرجات.

أضف كلا البصمتين (Debug و Release) في **Firebase Console** → مشروعك → إعدادات المشروع → تطبيقات Android → إضافة بصمة الإصبع.

### 4. بناء ملف AAB
```bash
cd android && ./gradlew bundleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
```
أو من جذر المشروع:
```bash
npm run build:android:aab
```

### 5. مكان ملف AAB
بعد نجاح البناء:
`android/app/build/outputs/bundle/release/app-release.aab`

ارفع هذا الملف إلى **Google Play Console** (Production أو أي مسار اختبار).

---

## بناء ورفع التطبيق على App Gallery (هواوي)

App Gallery يقبل ملف **AAB** أو **APK**. الأفضل استخدام نفس ملف AAB الذي تبنيّه أعلاه.

### 1. بناء ملف AAB
اتبع الخطوات في قسم "بناء AAB لرفعه على Google Play Store" أعلاه. الملف الناتج:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### 2. إنشاء التطبيق في AppGallery Connect
1. ادخل إلى [AppGallery Connect](https://developer.huawei.com/consumer/en/service/josp/agc/index.html) وسجّل الدخول.
2. من **My projects** اختر مشروعك (أو أنشئ مشروعاً جديداً).
3. من **My Apps** اضغط **Add app**.
4. اختر **Android**، أدخل اسم التطبيق (مثلاً: دنانير) و**Package name** مطابقاً لـ `app.json` وهو: `com.mrcodeiq.dinar`.
5. أنشئ التطبيق.

### 3. توقيع التطبيق (App Signing)
- من صفحة التطبيق: **Distribute** → **App signing**.
- **للأفضلية:** اختر أن تدير AppGallery التوقيع النهائي (يُطلب منك رفع شهادة الـ upload key).
- صدّر شهادة الـ upload key بصيغة PEM من الـ keystore الحالي:
  ```bash
  keytool -export -rfc -keystore android/app/dnanir-release.keystore -alias dnanir -file upload_certificate.pem
  ```
- ارفع `upload_certificate.pem` في AppGallery Connect حسب التعليمات في الشاشة.

### 4. رفع النسخة (AAB)
1. من التطبيق في AppGallery Connect: **Distribute** → **App release** (أو **Version**).
2. اختر **Production** (أو **Testing** للتجربة).
3. اضغط **Create new version** ثم **Upload** واختر ملف:
   `android/app/build/outputs/bundle/release/app-release.aab`
4. بعد الرفع، املأ **Version description** و**What’s new** ثم احفظ.

### 5. إكمال معلومات المتجر والإرسال للمراجعة
- من **Distribute** → **Store listing** (أو **App information**): املأ الوصف، لقطات الشاشة، الأيقونة، سياسة الخصوصية، إلخ.
- بعد اكتمال كل الأقسام المطلوبة، من **App release** اختر **Submit for review** لإرسال النسخة للمراجعة.

بعد الموافقة، التطبيق سيظهر في App Gallery.

---

## بناء APK فقط (للتوزيع خارج المتجر)

### إعداد البيئة (مرة واحدة)
تأكد من وجود **Java JDK 17** و**Android SDK**:

```bash
# Java (مثلاً عبر Homebrew)
brew install openjdk@17
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home

# موقع الـ SDK: إن لم يكن مضبوطاً، أنشئ android/local.properties:
# sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

*(ملف `android/local.properties` يُنشأ تلقائياً إن فتحت المشروع من Android Studio؛ أو أنشئه يدوياً كما أعلاه.)*

### أمر البناء
```bash
npm run build:android:apk
```
أو يدوياً مع تعيين المتغيرات:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
cd android && ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
```

### مكان الملف الناتج
`android/app/build/outputs/apk/release/app-release.apk`

---

## أوامر مفيدة أخرى

### تنضيف ملفات البناء
```bash
cd android && ./gradlew clean
```

### بناء نسخة Debug
```bash
cd android && ./gradlew assembleDebug
```

### توفير مساحة
```bash
npm cache clean --force
rm -rf android/app/build
```
