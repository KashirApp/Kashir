#!/bin/bash

# Script to combine multiple UniFFI frameworks into a single framework
set -e

echo "🔧 Combining NostrSdk and Foobar frameworks..."

# Clean up any existing combined framework
rm -rf RustNostrNostrSdkReactNativeFramework.xcframework

# Create directories for the combined framework
mkdir -p combined-libs/ios-arm64
mkdir -p combined-libs/ios-arm64-simulator

# Combine the .a files for arm64
echo "📱 Combining arm64 libraries..."
libtool -static -o combined-libs/ios-arm64/libcombined.a \
  NostrSdkFramework.xcframework/ios-arm64/libnostr_sdk_ffi.a \
  FoobarFramework.xcframework/ios-arm64/libfoobar.a

# Combine the .a files for simulator  
echo "🖥️  Combining simulator libraries..."
libtool -static -o combined-libs/ios-arm64-simulator/libcombined.a \
  NostrSdkFramework.xcframework/ios-arm64-simulator/libnostr_sdk_ffi.a \
  FoobarFramework.xcframework/ios-arm64-simulator/libfoobar.a

# Create the combined xcframework
echo "📦 Creating combined xcframework..."
xcodebuild -create-xcframework \
  -library combined-libs/ios-arm64/libcombined.a \
  -library combined-libs/ios-arm64-simulator/libcombined.a \
  -output RustNostrNostrSdkReactNativeFramework.xcframework

# Clean up temporary files
rm -rf combined-libs

echo "✅ Combined framework created: RustNostrNostrSdkReactNativeFramework.xcframework"
echo "   Contains both nostr-sdk-ffi and foobar libraries" 