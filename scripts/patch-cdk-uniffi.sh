#!/bin/bash
# Patch CDK submodule configuration:
# - Change uniffi version from 0.30 to =0.28.3 (in workspace Cargo.toml)
# - Change default features from ["postgres", "npubcash", "bip353"] to ["npubcash", "bip353"] (in cdk-ffi Cargo.toml)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CDK_WORKSPACE_CARGO="$PROJECT_ROOT/deps/cdk/Cargo.toml"
CDK_FFI_CARGO="$PROJECT_ROOT/deps/cdk/crates/cdk-ffi/Cargo.toml"

if [ ! -f "$CDK_WORKSPACE_CARGO" ]; then
  echo "❌ CDK workspace Cargo.toml not found at $CDK_WORKSPACE_CARGO"
  echo "   Run 'git submodule update --init' first"
  exit 1
fi

if [ ! -f "$CDK_FFI_CARGO" ]; then
  echo "❌ CDK FFI Cargo.toml not found at $CDK_FFI_CARGO"
  echo "   Run 'git submodule update --init' first"
  exit 1
fi

echo "🔧 Patching CDK configuration..."

# Use sed to replace the uniffi version in workspace Cargo.toml and default features in cdk-ffi
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS sed requires empty string after -i
  sed -i '' 's/uniffi = "0.30"/uniffi = "=0.28.3"/' "$CDK_WORKSPACE_CARGO"
  sed -i '' 's/default = \["postgres", "npubcash", "bip353"\]/default = ["npubcash", "bip353"]/' "$CDK_FFI_CARGO"
else
  # Linux sed
  sed -i 's/uniffi = "0.30"/uniffi = "=0.28.3"/' "$CDK_WORKSPACE_CARGO"
  sed -i 's/default = \["postgres", "npubcash", "bip353"\]/default = ["npubcash", "bip353"]/' "$CDK_FFI_CARGO"
fi

echo "✅ Successfully patched CDK configuration (uniffi version + default features)"
