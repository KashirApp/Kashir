#!/bin/bash
# Patch CDK submodule configuration:
# - Change uniffi version from 0.29 to =0.28.3
# - Change default features from ["postgres"] to []

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CDK_CARGO="$PROJECT_ROOT/deps/cdk/crates/cdk-ffi/Cargo.toml"

if [ ! -f "$CDK_CARGO" ]; then
  echo "❌ CDK Cargo.toml not found at $CDK_CARGO"
  echo "   Run 'git submodule update --init' first"
  exit 1
fi

echo "🔧 Patching CDK configuration..."

# Use sed to replace the uniffi version line and default features
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS sed requires empty string after -i
  sed -i '' 's/uniffi = { version = "0.29"/uniffi = { version = "=0.28.3"/' "$CDK_CARGO"
  sed -i '' 's/default = \["postgres"\]/default = []/' "$CDK_CARGO"
else
  # Linux sed
  sed -i 's/uniffi = { version = "0.29"/uniffi = { version = "=0.28.3"/' "$CDK_CARGO"
  sed -i 's/default = \["postgres"\]/default = []/' "$CDK_CARGO"
fi

echo "✅ Successfully patched CDK configuration (uniffi version + default features)"
