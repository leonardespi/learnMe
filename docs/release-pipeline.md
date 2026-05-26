# Release pipeline — setup record

Workflow: `.github/workflows/release.yml`  
Trigger: `git tag v*` → `git push origin v<tag>`

---

## Architecture

| Job | Runner | Multiplier | Output |
|---|---|---|---|
| `build-desktop` (Linux) | ubuntu-22.04 | 1× | `.deb`, `.rpm`, `.AppImage` |
| `build-desktop` (macOS) | macos-latest (arm64) | 10× | `.dmg` |
| `build-desktop` (Windows) | windows-latest | 2× | `.nsis` |
| `build-android` | ubuntu-22.04 | 1× | `.apk` |

Desktop jobs use `tauri-apps/tauri-action@v0` which creates the GitHub release on the first job to finish and attaches artifacts from subsequent jobs. Android runs `npx tauri android build --apk` directly and uploads via `softprops/action-gh-release@v2`.

Rust build time cut ~65% after first run via `Swatinem/rust-cache@v2`. Node deps cached via `actions/setup-node cache: npm`.

---

## Non-obvious requirements in the repo

### 1. `npm run tauri` script in `package.json`

`tauri-apps/tauri-action` calls `npm run tauri build -- <args>`. Without a `"tauri"` script the step fails immediately with `Missing script: "tauri"`. Added:

```json
"tauri": "tauri"
```

The local convenience scripts (`tauri:dev`, `tauri:build`) can coexist.

---

### 2. `tsconfig.build.json` — separate build typecheck

`tsconfig.json` includes `tests/unit` for IDE/Vitest support. `tests/unit/app.test.ts` imports `@/app` (lowercase). On case-insensitive filesystems (macOS, Windows), TypeScript resolves `@/app` to both `src/app/index.ts` AND `src/App.tsx` and throws:

```
error TS1149: File name '…/src/app.tsx' differs from already included file name '…/src/App.tsx' only in casing.
```

Fix: `tsconfig.build.json` extends the main config but includes only `src/` and `vite.config.ts`, excluding `tests/unit`:

```json
{ "extends": "./tsconfig.json", "include": ["src", "vite.config.ts"] }
```

`package.json` `"build"` script uses it: `tsc -p tsconfig.build.json && vite build`.  
`npm run typecheck` still uses the full `tsconfig.json`.

---

### 3. macOS codesigning disabled in `tauri.conf.json`

Without an Apple Developer certificate, the Tauri bundler attempts ad-hoc codesigning and fails. Passing empty signing env vars to `tauri-apps/tauri-action` makes the situation worse — the action calls `security import` with empty certificate data, which throws `SecKeychainItemImport` errors.

Two-part fix applied:

**`src-tauri/tauri.conf.json`** — disables signing at the Tauri level:
```json
"bundle": {
  "macOS": { "signingIdentity": null }
}
```

**`.github/workflows/release.yml`** — signing env vars are NOT passed (not even as empty strings). Setting them to `""` is not the same as not setting them: the action checks presence, not value, in some versions.

To enable signing later, add secrets to **repo Settings → Secrets → Actions** and add the env vars to the workflow step:
```yaml
env:
  APPLE_CERTIFICATE:          ${{ secrets.APPLE_CERTIFICATE }}   # base64-encoded .p12
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_SIGNING_IDENTITY:     ${{ secrets.APPLE_SIGNING_IDENTITY }}
  APPLE_ID:                   ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD:             ${{ secrets.APPLE_PASSWORD }}      # app-specific password
  APPLE_TEAM_ID:              ${{ secrets.APPLE_TEAM_ID }}
```
Also remove `"signingIdentity": null` from `tauri.conf.json` when you want real signing.

---

### 4. Android project committed in `src-tauri/gen/android/`

`tauri android build` requires the Android Gradle project to exist. It is generated once locally via `npx tauri android init` and committed. The `.gitignore` inside that directory excludes build artifacts, `local.properties`, and keystore files.

**`.gitignore` at repo root** — changed from `src-tauri/gen/` to `src-tauri/gen/schemas/` so the Android project is tracked while generated JSON schemas remain ignored.

To regenerate (after upgrading Tauri or changing app identifier):
```bash
export ANDROID_HOME=~/android-sdk
export NDK_HOME=$ANDROID_HOME/ndk/26.1.10909125
export JAVA_HOME=~/.sdkman/candidates/java/current
npx tauri android init
```
Then commit the updated `src-tauri/gen/android/` and re-copy the icons (step 5).

---

### 5. Full icon set in `src-tauri/icons/`

Tauri requires platform-specific icon formats:
- `.icns` for macOS `.dmg` bundle
- `.ico` for Windows NSIS installer
- `mipmap-*` PNGs for Android launcher

Generated from `icons/icon.png` (256×256 RGBA):
```bash
npx tauri icon icons/icon.png -o src-tauri/icons
```

Icons committed in `src-tauri/icons/`. The Android mipmaps are also copied into the Android project:
```bash
cp -r src-tauri/icons/android/* src-tauri/gen/android/app/src/main/res/
```

`tauri.conf.json` bundle icon list updated to reference `src-tauri/icons/`:
```json
"icon": [
  "icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png",
  "icons/icon.icns", "icons/icon.ico", "icons/icon.png"
]
```

---

## Adding Windows signing

```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY:          ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

Same rule applies: only add these if the secrets are actually set. Empty strings cause `tauri-apps/tauri-action` to attempt signing and fail.

---

## Adding a new release

```bash
git tag -a v<x.y.z> -m "learnMe v<x.y.z>"
git push origin v<x.y.z>
```

The workflow creates the GitHub release and attaches all artifacts automatically. The first job to finish creates the release; subsequent jobs upload to it. No manual steps.
