#!/bin/bash

# Build script for Android that handles both nostr-sdk-ffi and cdk-ffi
# Forwards all arguments (like --release) to both build commands

set -e

echo "Building nostr-sdk-ffi for Android..."
ubrn build android --config ubrn.nostr.config.yaml --and-generate "$@"

echo "Building cdk-ffi for Android..."
ubrn build android --config ubrn.cdk.config.yaml --and-generate "$@"

echo "Fixing C++ bindings to include both nostr-sdk and cdk..."
./scripts/fix-cpp-bindings.sh --skip-ios

echo "Android build completed successfully!" 