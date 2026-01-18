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

# Patch 1: report_memory_usage.py - disable the function entirely
# This fixes: NameError: name 'task_gen262144' is not defined
# and TypeError: list indices must be integers or slices, not str
REPORT_FILE=$(find ~/.pebble-sdk -name "report_memory_usage.py" 2>/dev/null | head -1)
if [ -n "$REPORT_FILE" ]; then
  echo "Found: $REPORT_FILE"
  python3 << 'PATCHPY'
import os
import glob

# Find all report_memory_usage.py files
report_files = glob.glob(os.path.expanduser("~/.pebble-sdk/**/report_memory_usage.py"), recursive=True)

for report_file in report_files:
    try:
        with open(report_file, 'r') as f:
            content = f.read()
        
        # Check if already patched
        if "return  # PATCHED" in content:
            print(f"  Already patched: {report_file}")
            continue
        
        # Find and patch the function definition
        old_def = "def generate_memory_usage_report(task_gen):"
        if old_def in content:
            lines = content.split('\n')
            new_lines = []
            for i, line in enumerate(lines):
                new_lines.append(line)
                if old_def in line:
                    # Add return with tab indentation
                    new_lines.append('\treturn  # PATCHED: skip memory report')
            content = '\n'.join(new_lines)
            with open(report_file, 'w') as f:
                f.write(content)
            print(f"  Patched: {report_file}")
        else:
            print(f"  Pattern not found in: {report_file}")
    except Exception as e:
        print(f"  Error patching {report_file}: {e}")

if not report_files:
    print("  No report_memory_usage.py files found")
PATCHPY
else
  echo "  report_memory_usage.py not found"
fi

# Patch 2: process_bundle.py - fix binaries attribute
# This fixes: AttributeError: 'task_gen' object has no attribute 'binaries'
BUNDLE_FILE=$(find ~/.pebble-sdk -name "process_bundle.py" 2>/dev/null | head -1)
if [ -n "$BUNDLE_FILE" ]; then
  echo ""
  echo "Patching process_bundle.py..."
  python3 << 'PATCHPY'
import os
import glob

bundle_files = glob.glob(os.path.expanduser("~/.pebble-sdk/**/process_bundle.py"), recursive=True)

for bundle_file in bundle_files:
    try:
        with open(bundle_file, 'r') as f:
            content = f.read()
        
        if 'task_gen.binaries' in content and 'getattr(task_gen, "binaries", [])' not in content:
            content = content.replace('task_gen.binaries', 'getattr(task_gen, "binaries", [])')
            with open(bundle_file, 'w') as f:
                f.write(content)
            print(f"  Patched: {bundle_file}")
        else:
            print(f"  Already patched or pattern not found: {bundle_file}")
    except Exception as e:
        print(f"  Error patching {bundle_file}: {e}")

if not bundle_files:
    print("  No process_bundle.py files found")
PATCHPY
else
  echo "  process_bundle.py not found"
fi

# Patch 3: Node.py - handle missing files gracefully
NODE_FILE=$(find ~/.pebble-sdk -path "*waflib/Node.py" 2>/dev/null | head -1)
if [ -n "$NODE_FILE" ]; then
  echo ""
  echo "Patching Node.py..."
  python3 << 'PATCHPY'
import os
import glob

node_files = glob.glob(os.path.expanduser("~/.pebble-sdk/**/waflib/Node.py"), recursive=True)

for node_file in node_files:
    try:
        with open(node_file, 'r') as f:
            content = f.read()
        
        old_pattern = "def h_file(self):\n\t\treturn Utils.h_file(self.abspath())"
        new_pattern = """def h_file(self):
\t\ttry:
\t\t\treturn Utils.h_file(self.abspath())
\t\texcept (OSError, IOError):
\t\t\treturn b'0'*32"""

        if old_pattern in content:
            content = content.replace(old_pattern, new_pattern)
            with open(node_file, 'w') as f:
                f.write(content)
            print(f"  Patched: {node_file}")
        else:
            print(f"  Already patched or pattern not found: {node_file}")
    except Exception as e:
        print(f"  Error patching {node_file}: {e}")

if not node_files:
    print("  No Node.py files found")
PATCHPY
else
  echo "  Node.py not found"
fi

echo ""
echo "===== All patches applied! ====="
echo ""
echo "Now run:"
echo "  cd /workspaces/codespaces-pebble/SonicFTW"
echo "  pebble build"
