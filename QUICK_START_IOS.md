# 🚀 Quick Start - iOS

## One-Command Setup

```bash
./ios-setup.sh
```

## Open in Xcode

```bash
open ios/*.xcworkspace
```

**⚠️ Always open `.xcworkspace`, NOT `.xcodeproj`!**

## Build & Run

1. Select device/simulator in Xcode toolbar
2. Press `Cmd + R` or click ▶️ Play button

## First Time Setup

1. **Select Team**: Xcode → Project → Signing & Capabilities → Select Team
2. **Trust Device** (if using physical device):
   - Settings → General → VPN & Device Management → Trust Developer

## Common Issues

### No Team Selected
- Xcode → Preferences → Accounts → Add Apple ID

### Pod Install Error
```bash
cd ios && pod install && cd ..
```

### Clean Build
- Xcode: Product → Clean Build Folder (Shift+Cmd+K)

---

**Full guide**: See `IOS_SETUP.md`
