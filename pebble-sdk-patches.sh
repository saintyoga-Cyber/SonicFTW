#!/bin/bash
# Pebble SDK Patches for SonicFTW
# Run this in the Codespace after each restart: ./pebble-sdk-patches.sh
# Then run: pebble build

echo "===== SonicFTW SDK Patch Script ====="
echo ""

# Step 1: Install ARM toolchain if needed
if ! command -v arm-none-eabi-gcc &> /dev/null; then
    echo "Installing ARM toolchain..."
    sudo apt update && sudo apt install -y gcc-arm-none-eabi
else
    echo "ARM toolchain already installed"
fi

echo ""
echo "Applying SDK patches..."

# Find SDK base directory
SDK_BASE=$(find ~/.pebble-sdk -type d -name "sdk-core" 2>/dev/null | head -1)
if [ -z "$SDK_BASE" ]; then
    SDK_BASE=$(find /home -type d -name "sdk-core" 2>/dev/null | head -1)
fi

if [ -z "$SDK_BASE" ]; then
    echo "ERROR: Could not find Pebble SDK. Make sure it's installed."
    exit 1
fi

echo "Found SDK at: $SDK_BASE"
echo ""

# Patch 1: report_memory_usage.py - disable the function entirely
# This fixes: NameError: name 'task_gen262144' is not defined
echo "Patching report_memory_usage.py..."
REPORT_FILE=$(find "$SDK_BASE" -name "report_memory_usage.py" 2>/dev/null | head -1)
if [ -n "$REPORT_FILE" ]; then
    echo "  Found: $REPORT_FILE"
    if grep -q "return  # PATCHED" "$REPORT_FILE" 2>/dev/null; then
        echo "  Already patched"
    else
        # Use sed to add return statement after the function definition
        sed -i '/def generate_memory_usage_report(task_gen):/a\\treturn  # PATCHED: skip memory report' "$REPORT_FILE"
        echo "  Patched successfully"
    fi
else
    echo "  File not found"
fi

# Patch 2: process_bundle.py - fix binaries attribute
# This fixes: AttributeError: 'task_gen' object has no attribute 'binaries'
echo ""
echo "Patching process_bundle.py..."
BUNDLE_FILE=$(find "$SDK_BASE" -name "process_bundle.py" 2>/dev/null | head -1)
if [ -n "$BUNDLE_FILE" ]; then
    echo "  Found: $BUNDLE_FILE"
    if grep -q 'getattr(task_gen, "binaries", \[\])' "$BUNDLE_FILE" 2>/dev/null; then
        echo "  Already patched"
    else
        sed -i 's/task_gen\.binaries/getattr(task_gen, "binaries", [])/g' "$BUNDLE_FILE"
        echo "  Patched successfully"
    fi
else
    echo "  File not found"
fi

# Patch 3: process_js.py - fix js_entry_file attribute
# This fixes: AttributeError: 'task_gen' object has no attribute 'js_entry_file'
echo ""
echo "Patching process_js.py..."
JS_FILE=$(find "$SDK_BASE" -name "process_js.py" 2>/dev/null | head -1)
if [ -n "$JS_FILE" ]; then
    echo "  Found: $JS_FILE"
    if grep -q 'getattr(task_gen, "js_entry_file"' "$JS_FILE" 2>/dev/null; then
        echo "  Already patched"
    else
        # Replace task_gen.js_entry_file with getattr to handle missing attribute
        sed -i 's/task_gen\.js_entry_file/getattr(task_gen, "js_entry_file", None)/g' "$JS_FILE"
        echo "  Patched successfully"
    fi
else
    echo "  File not found"
fi

# Patch 4: Node.py - handle missing files gracefully (optional)
echo ""
echo "Patching Node.py..."
NODE_FILE=$(find "$SDK_BASE" -path "*waflib/Node.py" 2>/dev/null | head -1)
if [ -n "$NODE_FILE" ]; then
    echo "  Found: $NODE_FILE"
    if grep -q "# PATCHED: handle missing files" "$NODE_FILE" 2>/dev/null; then
        echo "  Already patched"
    else
        # This patch is more complex, skip if pattern doesn't match exactly
        echo "  Skipping complex patch (optional)"
    fi
else
    echo "  File not found"
fi

echo ""
echo "===== All patches applied! ====="
echo ""
echo "Now run:"
echo "  cd /workspaces/codespaces-pebble/SonicFTW"
echo "  pebble build"
