#!/bin/bash

# Build script for Android that handles both nostr-sdk-ffi and cdk-ffi
# Builds for arm64-v8a architecture only
# Forwards all arguments (like --release) to both build commands

set -e

echo "Building nostr-sdk-ffi for Android (arm64-v8a)..."
ubrn build android --config ubrn.nostr.config.yaml --and-generate --targets arm64-v8a "$@"

echo "Building cdk-ffi for Android (arm64-v8a, without overwriting jniLibs)..."
ubrn build android --config ubrn.cdk.config.yaml --and-generate --no-jniLibs --targets arm64-v8a "$@"

echo "Copying CDK library to jniLibs directory..."
# Determine build type (debug or release)
if [[ "$*" == *"--release"* ]] || [[ "$*" == *"-r"* ]]; then
    build_type="release"
else
    build_type="debug" 
fi

src_file="deps/cdk-ffi/target/aarch64-linux-android/$build_type/libcdk_ffi.a"
dest_file="android/src/main/jniLibs/arm64-v8a/libcdk_ffi.a"

if [ -f "$src_file" ]; then
    mkdir -p "android/src/main/jniLibs/arm64-v8a"
    cp "$src_file" "$dest_file"
    echo "   ✅ Copied arm64-v8a CDK library"
else
    echo "   ❌ CDK library not found: $src_file"
    exit 1
fi

echo "Fixing C++ bindings to include both nostr-sdk and cdk..."
./scripts/fix-cpp-bindings.sh --skip-ios

echo "Android build completed successfully!" 