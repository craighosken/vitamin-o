# Pen Tracker – Android app

Capacitor wrapper around `../pen-tracker.html` (the same file that powers the web artifact).
`npm run build:web` copies it to `www/index.html` and injects `src/native.js`, which only
activates inside the app:

- **Saved data** is mirrored into app storage (Capacitor Preferences), so Android backup
  restores it on a new phone. Same key as the web version: `ozempic-pen-planner-v2`.
- **Reminders** (phone notifications): 7 pm the evening before each dose (next 16 weeks),
  and 9 am 14 days before a new pen is needed when there is no spare. Rescheduled on every save.
- **Photo** uses the Android photo picker / camera, then the existing crop screen.

App id `com.craighosken.pentracker`, name "Pen Tracker". Icon source: `assets/`.

## Build
Needs Node 22, Java 21 and the Android SDK (or Android Studio).

    npm ci
    npm run sync                      # builds www/ and copies it into android/
    cd android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk

`web/pen-tracker.html` is the tracker copy used here (keep it in step with the live version). The workflow in
`../.github/workflows/android.yml` builds a debug APK on every push to main, plus a signed
Play bundle (AAB) once these repository secrets exist: `KEYSTORE_B64` (base64 of the upload
keystore), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

Bump `versionCode` in `android/app/build.gradle` for every Play upload.

## Renaming (before the first Play upload only; the package ID is permanent after that)
App name: `capacitor.config.json` appName and `android/app/src/main/res/values/strings.xml`.
Package ID: `capacitor.config.json` appId, `android/app/build.gradle` namespace + applicationId,
`strings.xml` package_name/custom_url_scheme, and move `MainActivity.java` to the matching folder.
