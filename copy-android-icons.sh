#!/bin/bash

# Script to copy properly padded Android icons to the native Android project
# This ensures icons don't get cut off at the edges

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/assets/icons/android/res"
TARGET_DIR="$SCRIPT_DIR/android/app/src/main/res"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory $SOURCE_DIR not found!"
    exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory $TARGET_DIR not found!"
    echo "Please run 'npx expo prebuild' first to generate the Android native project."
    exit 1
fi

echo "Copying Android icons from $SOURCE_DIR to $TARGET_DIR..."

# Copy all mipmap directories
cd "$SOURCE_DIR" || exit 1
for mipmap_dir in mipmap-*; do
    if [ -d "$mipmap_dir" ]; then
        echo "  Copying $mipmap_dir..."
        cp -r "$mipmap_dir" "$TARGET_DIR/"
    fi
done
cd "$SCRIPT_DIR" || exit 1

# Copy the adaptive icon XML if it exists
if [ -f "$SOURCE_DIR/mipmap-anydpi-v26/ic_launcher.xml" ]; then
    echo "  Copying adaptive icon XML..."
    mkdir -p "$TARGET_DIR/mipmap-anydpi-v26"
    cp "$SOURCE_DIR/mipmap-anydpi-v26/ic_launcher.xml" "$TARGET_DIR/mipmap-anydpi-v26/"
fi

echo "✅ Android icons copied successfully!"
echo "The icons in $TARGET_DIR are now using the properly padded versions."
