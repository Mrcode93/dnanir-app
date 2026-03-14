#!/bin/bash

# iOS Setup Script for دنانير App
# This script prepares the app for Xcode

echo "🚀 Setting up iOS project for Xcode..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if iOS folder exists, if not, generate it
if [ ! -d "ios" ]; then
    echo "📱 Generating iOS native project..."
    npx expo prebuild --platform ios --clean
else
    echo "✅ iOS folder already exists"
    echo "💡 To regenerate, run: npx expo prebuild --platform ios --clean"
fi

# Install pods
if [ -d "ios" ]; then
    echo "📦 Installing CocoaPods dependencies..."
    
    # Check if CocoaPods is installed
    if ! command -v pod &> /dev/null; then
        echo "❌ CocoaPods is not installed!"
        echo "💡 Install it with: sudo gem install cocoapods"
        exit 1
    fi
    
    cd ios
    if pod install; then
        cd ..
        echo "✅ CocoaPods installed"
    else
        cd ..
        echo "❌ Failed to install CocoaPods dependencies"
        exit 1
    fi
else
    echo "❌ iOS folder not found. Please run prebuild first."
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📱 Next steps:"
echo "1. Open Xcode: open ios/*.xcworkspace"
echo "2. Select your development team in Signing & Capabilities"
echo "3. Build and run: Product → Run (Cmd+R)"
echo ""
echo "⚠️  Important: Open .xcworkspace, NOT .xcodeproj!"
