# 📤 Upload App to App Store Using Xcode

This guide shows you how to upload your iOS app to App Store Connect using Xcode instead of EAS submit.

---

## 📋 Method 1: Download IPA from EAS and Upload via Xcode

### Step 1: Download the IPA File from EAS

You already have a build: `56018941-b905-4af2-a9b9-255e49e4ded2`

```bash
# Option A: Download directly via EAS
eas build:download --id 56018941-b905-4af2-a9b9-255e49e4ded2 --platform ios

# Option B: Download from EAS web interface
# 1. Go to: https://expo.dev/accounts/mrcodeiq/projects/sachmah/builds
# 2. Find your build
# 3. Click "Download" to get the .ipa file
```

The .ipa file will be downloaded to your current directory.

---

### Step 2: Upload Using Xcode

#### Option A: Using Xcode Organizer (Recommended)

1. **Open Xcode** (make sure you have the latest version)

2. **Open Organizer**:
   - Press `Cmd + Shift + 9` (or go to: Window → Organizer)
   - Or in Xcode menu: `Xcode → Organizer`

3. **Drag and Drop**:
   - Drag your `.ipa` file into the Organizer window
   - Or click the `+` button and select your `.ipa` file

4. **Select Distribution**:
   - Choose "App Store Connect"
   - Click "Upload"

5. **Sign In** (if prompted):
   - Enter your Apple ID: `mrcodeiq@icloud.com`
   - Use your App-Specific Password if required

6. **Wait for Upload**:
   - Xcode will validate and upload the app
   - You'll see progress in the Organizer

#### Option B: Using Transporter App (Alternative)

1. **Download Transporter** (if not installed):
   - From Mac App Store: Search "Transporter"
   - Or download from: https://apps.apple.com/app/transporter/id1450874784

2. **Open Transporter**:
   - Drag your `.ipa` file into Transporter
   - Or click "Add" and select your `.ipa` file

3. **Sign In**:
   - Enter Apple ID: `mrcodeiq@icloud.com`
   - Use App-Specific Password if prompted

4. **Upload**:
   - Click "Deliver" button
   - Wait for upload to complete

---

## 📋 Method 2: Build and Upload Directly from Xcode

### Step 1: Generate Native Project from Expo

```bash
# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Generate the native iOS project
npx expo prebuild --platform ios
```

This will create an `ios/` folder with a native Xcode project.

### Step 2: Open Project in Xcode

```bash
# Open the Xcode project
open ios/*.xcworkspace
```

**Note**: Open the `.xcworkspace` file, NOT the `.xcodeproj` file!

### Step 3: Configure Signing in Xcode

1. **Select Your Target**:
   - Click on your project in the left sidebar
   - Select your app target
   - Go to "Signing & Capabilities" tab

2. **Select Team**:
   - Choose your Apple Developer team
   - Xcode will automatically manage provisioning

3. **Verify Bundle ID**:
   - Should be: `com.mrcodeiq.dinar`
   - If different, update it to match

### Step 4: Build and Archive

1. **Select Destination**:
   - In Xcode toolbar, select "Any iOS Device" (not simulator)

2. **Create Archive**:
   - Go to menu: `Product → Archive`
   - Wait for build and archive to complete

3. **Organizer Opens Automatically**:
   - Once archive is ready, Organizer window opens

### Step 5: Upload to App Store Connect

1. **In Organizer**:
   - Select your archive
   - Click "Distribute App"

2. **Choose Distribution Method**:
   - Select "App Store Connect"
   - Click "Next"

3. **Choose Distribution Options**:
   - Select "Upload"
   - Click "Next"

4. **Review App Information**:
   - Verify all details
   - Click "Upload"

5. **Sign In** (if prompted):
   - Enter Apple ID: `mrcodeiq@icloud.com`
   - Use App-Specific Password

6. **Wait for Upload**:
   - Upload progress will be shown
   - Validation happens automatically

---

## 📋 Method 3: Use EAS Build to Get IPA, Then Upload Manually

### Step 1: Build with EAS (You Already Have This!)

Your build ID: `56018941-b905-4af2-a9b9-255e49e4ded2`

```bash
# Download the IPA file
eas build:download --id 56018941-b905-4af2-a9b9-255e49e4ded2 --platform ios
```

### Step 2: Upload via App Store Connect Web Interface

1. **Go to App Store Connect**:
   - https://appstoreconnect.apple.com
   - Sign in with `mrcodeiq@icloud.com`

2. **Navigate to Your App**:
   - My Apps → Your App (create if needed)

3. **Create New Version**:
   - Go to App Store tab
   - Click "+ Version or Platform"
   - Fill in version info

4. **Upload Build**:
   - Click "Build" section
   - Click "+" to add a build
   - **Note**: You'll need to use Transporter or Xcode to upload the build

---

## ✅ Recommended Workflow

### For Your Current Situation:

**Since you already have a build, use Method 1 (Easiest)**:

```bash
# 1. Download the IPA
eas build:download --id 56018941-b905-4af2-a9b9-255e49e4ded2 --platform ios

# 2. Open Xcode Organizer (Cmd + Shift + 9)

# 3. Drag the downloaded .ipa file into Organizer

# 4. Click "Upload" → Follow the prompts
```

---

## 🎯 Quick Steps Summary

1. **Download IPA** from EAS build
2. **Open Xcode** → Organizer (Cmd + Shift + 9)
3. **Drag IPA** into Organizer
4. **Click Upload** → Follow prompts
5. **Done!** Check App Store Connect for the build

---

## 🔍 Verify Upload in App Store Connect

After upload:

1. Go to: https://appstoreconnect.apple.com
2. My Apps → Your App
3. App Store → Versions
4. Your build should appear in "Build" section
5. Processing usually takes 10-30 minutes

---

## ⚠️ Important Notes

### If You Get Signing Errors:

1. **In Xcode**: Go to Preferences → Accounts
2. **Add your Apple ID** if not already added
3. **Download Manual Profiles** if needed
4. **Select the correct Team** in Signing & Capabilities

### If You Get Upload Errors:

- Make sure you're using **App-Specific Password** (not regular password)
- Verify your **Bundle ID** matches: `com.mrcodeiq.dinar`
- Check **Apple System Status**: https://www.apple.com/support/systemstatus/

---

## 📱 Alternative: Transporter App (Simplest)

If Xcode seems complicated:

1. **Download Transporter** from Mac App Store
2. **Drag your .ipa** file into Transporter
3. **Sign in** with Apple ID
4. **Click Deliver**
5. **Done!**

Transporter is specifically designed for uploading apps and is simpler than Xcode Organizer.

---

## 🆘 Troubleshooting

### "No valid 'aps-environment' entitlement"
- Your app uses push notifications - this is normal
- Make sure push notifications are configured in Xcode

### "Invalid Bundle"
- Check Bundle ID matches: `com.mrcodeiq.dinar`
- Verify version number is correct

### Upload Fails
- Try using Transporter app instead
- Check internet connection
- Verify Apple ID has correct permissions

---

## 📞 Need Help?

- Xcode Organizer Docs: https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
- Transporter Docs: https://apps.apple.com/app/transporter/id1450874784

