# Android Icon Edge Cutting Fix

## Problem
Android adaptive icons can have their edges cut off because different launchers mask the outer portions of the icon. Only the center **66%** of the icon (the "safe zone") is guaranteed to be visible.

## Solution

✅ **FIXED!** The properly padded Android icons from `assets/icons/android/res/` have been copied to the Android native project.

### Quick Usage

After running `npx expo prebuild`, run:
```bash
npm run copy:android-icons
```

Or use the combined command:
```bash
npm run android:prebuild
```

This will automatically copy the properly padded icons to the Android project.

---

## Manual Fix (If Needed)

If you need to create a new version of your logo with proper padding:

### Steps to Fix:

1. **Create a properly padded icon:**
   - Your icon should be **1024x1024 pixels**
   - Important content (text, graphics) should be within the center **512x512 pixel area** (66% of the total)
   - Add transparent padding around the edges (about 17% padding on each side)

2. **Using Image Editing Software (Photoshop, GIMP, Figma, etc.):**
   - Open your current `logo.png`
   - Create a new canvas: **1024x1024 pixels**
   - Place your logo in the center, ensuring it fits within a **512x512 pixel box** centered in the canvas
   - Add transparent padding around it
   - Export as PNG with transparency

3. **Quick Fix Using Online Tools:**
   - Use tools like [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-adaptive.html) or [Icon Kitchen](https://icon.kitchen/)
   - Upload your logo
   - These tools automatically add the safe zone padding

4. **Using Command Line (ImageMagick):**
   ```bash
   # Add 17% padding to center the logo
   convert logo.png -gravity center -background transparent -extent 1024x1024 logo_padded.png
   ```

5. **Replace the logo:**
   - Once you have the padded version, replace `./assets/logo.png` with the new version
   - Rebuild your app: `npx expo prebuild --clean` then rebuild

### Visual Guide:

```
┌─────────────────────────────────┐
│  Transparent Padding (17%)      │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   Safe Zone (66%)         │  │
│  │   [Your Logo Content]     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  Transparent Padding (17%)      │
└─────────────────────────────────┘
```

### Current Configuration:
- **Source Icons:** `./assets/icons/android/res/` (properly padded versions)
- **Target Location:** `./android/app/src/main/res/` (copied automatically)
- **Background Color:** `#F8F9FA` (light gray)
- **Safe Zone:** Center 512x512 pixels of a 1024x1024 image
- **Script:** `copy-android-icons.sh` (automatically copies icons after prebuild)

### Testing:
After updating the icon:
1. Run `npx expo prebuild --clean` to regenerate Android native files
2. Build and test on different Android devices/launchers
3. Check that the Arabic text "دنانير" is fully visible and not cut off

### Important Notes:
- The safe zone is approximately **512x512 pixels** in the center of a **1024x1024 pixel** canvas
- Different Android launchers may use different mask shapes (circle, rounded square, etc.)
- Always test on multiple devices/launchers to ensure your icon looks good everywhere
- The background color (`#F8F9FA`) will show through transparent areas of your foreground image
