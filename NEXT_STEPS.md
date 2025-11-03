# ✅ Keychain Password Deleted - Next Steps

## ✅ What I Just Did:
- Deleted the stored Apple ID password from macOS Keychain
- Now EAS will prompt for a new password when you run submit

---

## 🚀 Option 1: Use App-Specific Password (Try This First)

### Step 1: Create App-Specific Password
1. Go to: **https://appleid.apple.com**
2. Sign in with: `mrcodeiq@icloud.com`
3. Click: **Security** → **Sign-In and Security** → **App-Specific Passwords**
4. Click: **Generate an app-specific password**
5. Name it: **"EAS Submit"**
6. **COPY THE PASSWORD** (shown only once - looks like: `xxxx-xxxx-xxxx-xxxx`)

### Step 2: Run Submit Command
```bash
# Clear any remaining cache
rm -rf ~/.app-store/auth/*

# Run submit - it will prompt for password
eas submit --platform ios --profile production
```

### Step 3: When Prompted
- **Apple ID**: `mrcodeiq@icloud.com`
- **Password**: Paste your **App-Specific Password** (NOT your regular password!)

---

## 🔑 Option 2: Use API Key (RECOMMENDED - Most Reliable)

This completely bypasses password authentication and is more reliable!

### Step 1: Create API Key in App Store Connect
1. Go to: **https://appstoreconnect.apple.com**
2. Sign in → **Users and Access** → **Keys** tab
3. Click **Generate API Key** (+ button)
4. Fill in:
   - **Name**: `EAS Submit Key`
   - **Access**: Select **App Manager**
5. Click **Generate**
6. **IMPORTANT**: Download the `.p8` file (you can only download once!)
7. **COPY**:
   - **Key ID** (shown on the page, looks like: `ABC123DEF4`)
   - **Issuer ID** (shown at top of Keys page, looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 2: Get Your App ID
1. Still in App Store Connect → **My Apps**
2. Click your app (or create new with Bundle ID: `com.mrcodeiq.dinar`)
3. **Copy the App ID** from:
   - The URL: `appstoreconnect.apple.com/apps/{APP_ID}/...`
   - Or the app details page

### Step 3: Save API Key File to Project
```bash
# Copy the downloaded .p8 file to your project
cp ~/Downloads/AuthKey_*.p8 ./AuthKey.p8

# Add to .gitignore (CRITICAL - never commit this!)
echo "AuthKey*.p8" >> .gitignore
echo "*.p8" >> .gitignore
```

### Step 4: Update eas.json
Edit `eas.json` and update the `ios` section:

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

Replace:
- `YOUR_APP_ID_HERE` → Your App Store Connect App ID
- `YOUR_KEY_ID_HERE` → The Key ID you copied
- `YOUR_ISSUER_ID_HERE` → The Issuer ID you copied

### Step 5: Submit
```bash
eas submit --platform ios --profile production
```

**No password prompt needed!** 🎉

---

## 🆘 If Still Getting "Internal Server Error"

This could mean:
1. **Apple servers are down** - Check: https://www.apple.com/support/systemstatus/
2. **Account issue** - Try logging into App Store Connect manually first
3. **Wait 10-15 minutes** and try again (temporary Apple issue)

---

## 📋 Quick Reference

```bash
# Clear auth cache
rm -rf ~/.app-store/auth/*

# Submit iOS (will prompt for App-Specific Password if not using API Key)
eas submit --platform ios --profile production

# Check builds
eas build:list --platform ios
```

