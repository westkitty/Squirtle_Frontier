#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_DIR="${SCRIPT_DIR:h}"
APP_NAME="Squirtle Frontier"
APP_BUNDLE="${REPO_DIR}/${APP_NAME}.app"
USER_APPS_DIR="${HOME}/Applications"
TARGET_APP="${USER_APPS_DIR}/${APP_NAME}.app"

echo "=== Building Squirtle Frontier macOS Desktop Wrapper ==="

# 1. Ensure production web build is current
cd "${REPO_DIR}"
echo "Building web bundle..."
npm run build

# 2. Prepare .app bundle directory structure
echo "Preparing app bundle structure..."
rm -rf "${APP_BUNDLE}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

# 3. Copy metadata and icons
echo "Installing metadata and icons..."
cp "${SCRIPT_DIR}/Info.plist" "${APP_BUNDLE}/Contents/Info.plist"
cp "${SCRIPT_DIR}/SquirtleFrontier.icns" "${APP_BUNDLE}/Contents/Resources/SquirtleFrontier.icns"

# 4. Embed self-contained web site bundle
echo "Embedding web site bundle..."
cp -R "${REPO_DIR}/dist" "${APP_BUNDLE}/Contents/Resources/site"

# 5. Compile native Cocoa + WebKit wrapper and in-process HTTP server
echo "Compiling native Mach-O executable..."
swiftc -O \
  -framework Cocoa \
  -framework WebKit \
  -framework Network \
  "${SCRIPT_DIR}/EmbeddedHTTPServer.swift" \
  "${SCRIPT_DIR}/main.swift" \
  -o "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"
chmod +x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"

# 6. Apply local ad-hoc code signature
echo "Signing application bundle..."
codesign --force --deep --sign - "${APP_BUNDLE}"

# 7. Install into user Applications directory
echo "Installing to ${TARGET_APP}..."
mkdir -p "${USER_APPS_DIR}"
rm -rf "${TARGET_APP}"
cp -R "${APP_BUNDLE}" "${TARGET_APP}"

# 8. Register with LaunchServices and mark the installed bundle/icon current.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${TARGET_APP}" || true
touch "${TARGET_APP}"
touch "${TARGET_APP}/Contents/Resources/SquirtleFrontier.icns"

# 9. Point the persistent Dock item at the freshly installed wrapper.
if command -v dockutil >/dev/null 2>&1; then
  echo "Configuring macOS Dock item..."
  dockutil --add "${TARGET_APP}" --label "${APP_NAME}" --replacing "${APP_NAME}" || \
  dockutil --add "${TARGET_APP}" --label "${APP_NAME}"
fi

# 10. Restart only the Dock process so macOS discards any cached icon for the old bundle.
# Dock is managed by macOS and relaunches automatically; the game itself is unaffected.
killall Dock >/dev/null 2>&1 || true

echo "=== Squirtle Frontier Desktop App Successfully Installed ==="
echo "Application: ${TARGET_APP}"
echo "Local Bundle: ${APP_BUNDLE}"
