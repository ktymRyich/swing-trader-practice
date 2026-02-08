# Tauri 2 iOS build notes

This project is set up for Tauri 2 with a static Next.js export.

## Prerequisites (macOS)

- Xcode (latest)
- Rust toolchain
- Tauri CLI (via npm or cargo)
- Apple ID (free Personal Team works, but builds expire in 7 days)

## Build steps

1. Install dependencies
    - npm install
2. Build the web frontend
    - TAURI_BUILD=true npm run build
3. Run on iOS simulator
    - npm run tauri:dev -- -b ios

## Device install (free Apple ID)

- Open the generated Xcode project when prompted.
- Select your personal team as the signing team.
- Deploy to your device.
- The app will expire after 7 days and must be re-installed.

## Notes

- Stock cache data is served from public/cache/\*.json.
- The app stores session data locally in IndexedDB.
