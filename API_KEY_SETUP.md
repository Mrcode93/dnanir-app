# 🔑 API Key Setup Guide - Fix Apple Authentication Error

## Why API Key?
Apple's servers are returning "internal server error" even with App-Specific Passwords. **API Key bypasses password authentication completely** and is more reliable.

---

## 📋 Step-by-Step Instructions

### Step 1: Create API Key in App Store Connect

1. **Go to**: https://appstoreconnect.apple.com
2. **Sign in** with: `mrcodeiq@icloud.com`
3. **Navigate**: Users and Access → **Keys** tab
4. **Click**: The **+** button (Generate API Key)
5. **Fill in**:
   - **Name**: `EAS Submit Key` (or any name you like)
   - **Access**: Select **App Manager** (gives permission to submit apps)
6. **Click**: **Generate**
7. **IMPORTANT**: 
   - **Download the `.p8` file** immediately (you can only download once!)
   - **Copy the Key ID** (visible on the page, looks like: `ABC123DEF4`)
   - **Copy the Issuer ID** (shown at top of Keys page, looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

---

### Step 2: Get Your App ID

**Option A: If your app already exists in App Store Connect**
1. Go to: **My Apps**
2. Click your app
3. **Copy the App ID** from:
   - The URL: `appstoreconnect.apple.com/apps/{APP_ID}/...`
   - Or from the app details page

**Option B: If you need to create the app**
1. Go to: **My Apps** → **+** button → **New App**
2. Fill in:
   - **Platform**: iOS
   - **Name**: `دنانير` (or "Dinar")
   - **Primary Language**: Arabic (or your choice)
   - **Bundle ID**: `com.mrcodeiq.dinar`
   - **SKU**: `com.mrcodeiq.dinar` (can be same as Bundle ID)
3. After creation, **copy the App ID** from the URL or page

---

### Step 3: Save API Key File to Project

```bash
# Navigate to your project
cd /Users/amerahmed/Desktop/dnanir-app

# Copy the downloaded .p8 file (check your Downloads folder)
cp ~/Downloads/AuthKey_*.p8 ./AuthKey.p8

# Or if you saved it elsewhere, copy from there
# cp ~/path/to/AuthKey_XXXXXXXXXX.p8 ./AuthKey.p8

# Add to .gitignore (CRITICAL - never commit API keys!)
echo "AuthKey*.p8" >> .gitignore
echo "*.p8" >> .gitignore
```

---

### Step 4: Update eas.json

Open `eas.json` and update the iOS submit section with your values:

```json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_ID_HERE",
        "ascApiKeyPath": "./AuthKey.p8",
        "ascApiKeyId": "YOUR_KEY_ID_HERE",
        "ascApiIssuer": "YOUR_ISSUER_ID_HERE"
      },
      "android": {
        "serviceAccountKeyPath": "./dnanir-app-e69e13cbbdc0.json"
      }
    }
  }
}
```

**Replace**:
- `YOUR_APP_ID_HERE` → The App ID from Step 2 (numeric ID like `1234567890`)
- `YOUR_KEY_ID_HERE` → The Key ID from Step 1 (like `ABC123DEF4`)
- `YOUR_ISSUER_ID_HERE` → The Issuer ID from Step 1 (UUID format)

---

### Step 5: Verify and Submit

```bash
# Clear any auth cache
rm -rf ~/.app-store/auth/*

# Submit (no password prompt needed!)
eas submit --platform ios --profile production
```

**That's it!** No password needed. 🎉

---

## ✅ Example eas.json

Here's what a completed `eas.json` looks like (with example values):

```json
{
  "cli": {
    "version": ">= 3.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "1234567890",
        "ascApiKeyPath": "./AuthKey.p8",
        "ascApiKeyId": "ABC123DEF4",
        "ascApiIssuer": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
      },
      "android": {
        "serviceAccountKeyPath": "./dnanir-app-e69e13cbbdc0.json"
      }
    }
  }
}
```

---

## 🔍 Finding Your Values

### Key ID
- Found on the Keys page after generating API Key
- Usually 10 characters, alphanumeric

### Issuer ID
- Found at the top of the Keys page
- UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### App ID
- Found in App Store Connect → My Apps → Your App
- Numeric ID (usually 10 digits)
- Also visible in URL: `.../apps/{APP_ID}/...`

---

## ⚠️ Security Notes

1. **Never commit `.p8` files to Git** - They're already in `.gitignore`
2. **Don't share API keys** - They give full access to your App Store Connect account
3. **Store `.p8` file safely** - Back it up securely (password manager, encrypted storage)

---

## 🆘 Troubleshooting

**"App not found"**
- Make sure `ascAppId` matches your App Store Connect App ID
- Verify the app exists in App Store Connect

**"Invalid API Key"**
- Check that the `.p8` file path is correct
- Verify Key ID and Issuer ID are correct (no extra spaces)
- Make sure the API Key has "App Manager" access

**"Permission denied"**
- Verify the API Key has correct permissions
- Make sure you're using the right Apple Developer account

---

## 📞 Need Help?

- EAS Docs: https://docs.expo.dev/submit/ios/#app-store-connect-api
- Apple Docs: https://developer.apple.com/documentation/appstoreconnectapi

