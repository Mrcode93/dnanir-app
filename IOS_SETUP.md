# 📱 iOS Setup Guide - دنانير App

This guide will help you set up and run the app in Xcode.

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
./ios-setup.sh
```

This will:
- Install dependencies
- Generate iOS native project
- Install CocoaPods dependencies

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Generate iOS project
npx expo prebuild --platform ios

# 3. Install CocoaPods
cd ios
pod install
cd ..
```

## 📂 Opening in Xcode

**⚠️ IMPORTANT: Always open the `.xcworkspace` file, NOT `.xcodeproj`!**

```bash
# Open the workspace
open ios/*.xcworkspace
```

Or manually:
1. Open Xcode
2. File → Open
3. Navigate to `ios/` folder
4. Select `*.xcworkspace` file

## ⚙️ Xcode Configuration

### 1. Select Development Team

1. In Xcode, click on your project in the left sidebar
2. Select your app target
3. Go to **Signing & Capabilities** tab
4. Under **Signing**, select your **Team**
5. Xcode will automatically manage provisioning profiles

### 2. Verify Bundle Identifier

- Should be: `com.mrcodeiq.dinar`
- If different, update it in **Signing & Capabilities**

### 3. Select Device/Simulator

- In Xcode toolbar, select:
  - **Any iOS Device** (for physical device)
  - **iPhone Simulator** (for testing)

## 🏗️ Building and Running

### Build for Simulator

1. Select an iPhone simulator from the device dropdown
2. Press `Cmd + R` or click the **Play** button
3. Wait for build to complete

### Build for Physical Device

1. Connect your iPhone via USB
2. Trust the computer on your iPhone if prompted
3. Select your device from the device dropdown
4. Press `Cmd + R` or click the **Play** button
5. On your iPhone: Settings → General → VPN & Device Management → Trust Developer

## 📋 iOS Requirements

- **Xcode**: Version 15.0 or later
- **iOS Deployment Target**: iOS 13.0 or later
- **macOS**: macOS 12.0 or later (for Xcode)

## 🔧 Troubleshooting

### "No such module 'ExpoModulesCore'"

```bash
cd ios
pod install
cd ..
```

### "Signing for [App] requires a development team"

1. Go to **Signing & Capabilities** in Xcode
2. Select your **Team**
3. If no team available, add your Apple ID:
   - Xcode → Preferences → Accounts
   - Click **+** to add Apple ID

### "Build Failed" or "Module not found"

```bash
# Clean build folder
cd ios
rm -rf build
pod deintegrate
pod install
cd ..

# In Xcode: Product → Clean Build Folder (Shift+Cmd+K)
```

### "Unable to install app" on device

1. Check device is trusted: Settings → General → VPN & Device Management
2. Verify Bundle ID matches in Xcode
3. Check device has enough storage
4. Restart device and try again

### Fonts not loading

The Cairo font should be automatically linked. If not:

1. In Xcode, check **Info.plist** has:
   - `UIAppFonts` array with `Cairo-Regular.ttf`
2. Verify font file exists in `assets/fonts/`

## 📱 Testing on Device

### Enable Developer Mode (iOS 16+)

1. Settings → Privacy & Security → Developer Mode
2. Toggle **Developer Mode** ON
3. Restart device when prompted

### Trust Developer Certificate

1. After first install, go to:
   - Settings → General → VPN & Device Management
2. Tap on your developer certificate
3. Tap **Trust**

## 🎯 Build for App Store

See `XCODE_UPLOAD_GUIDE.md` for detailed instructions on:
- Creating an archive
- Uploading to App Store Connect
- Submitting for review

## 📦 Dependencies

The app uses:
- **Expo SDK**: ~54.0.12
- **React Native**: 0.81.4
- **React**: 19.1.0

All dependencies are managed via:
- `npm` for JavaScript packages
- `CocoaPods` for iOS native modules

## 🔄 Updating Dependencies

```bash
# Update npm packages
npm update

# Update iOS pods
cd ios
pod update
cd ..
```

## 📝 Notes

- The app uses **Expo Development Build** (not Expo Go)
- RTL (Right-to-Left) is enabled for Arabic support
- Light theme is configured by default
- Notifications require proper permissions setup

## 🆘 Need Help?

- Check Expo docs: https://docs.expo.dev/
- Xcode documentation: https://developer.apple.com/xcode/
- React Native docs: https://reactnative.dev/

---

**Ready to build!** 🚀
