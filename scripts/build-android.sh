#!/bin/bash

# Build script for Android that handles both nostr-sdk-ffi and cdk-ffi
# Forwards all arguments (like --release) to both build commands

set -e

echo "Building nostr-sdk-ffi for Android..."
ubrn build android --config ubrn.nostr.config.yaml --and-generate "$@"

echo "Building cdk-ffi for Android (without overwriting jniLibs)..."
ubrn build android --config ubrn.cdk.config.yaml --and-generate --no-jniLibs "$@"

echo "Copying CDK libraries to jniLibs directory..."
# Copy CDK libraries to preserve both nostr-sdk and CDK libraries
for arch in arm64-v8a armeabi-v7a x86_64 x86; do
    case $arch in
        arm64-v8a) rust_target="aarch64-linux-android" ;;
        armeabi-v7a) rust_target="armv7-linux-androideabi" ;;
        x86_64) rust_target="x86_64-linux-android" ;;
        x86) rust_target="i686-linux-android" ;;
    esac
    
    # Determine build type (debug or release)
    if [[ "$*" == *"--release"* ]] || [[ "$*" == *"-r"* ]]; then
        build_type="release"
    else
        build_type="debug" 
    fi
    
    src_file="deps/cdk-ffi/target/$rust_target/$build_type/libcdk_ffi.a"
    dest_file="android/src/main/jniLibs/$arch/libcdk_ffi.a"
    
    if [ -f "$src_file" ]; then
        mkdir -p "android/src/main/jniLibs/$arch"
        cp "$src_file" "$dest_file"
        echo "   ✅ Copied $arch CDK library"
    else
        echo "   ⚠️  CDK library not found for $arch: $src_file"
    fi
done

echo "Fixing C++ bindings to include both nostr-sdk and cdk..."
./scripts/fix-cpp-bindings.sh --skip-ios

echo "Android build completed successfully!" 