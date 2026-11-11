# Photo Feature Review — Take Photo / Add Picture

**Verdict:** APPROVED  
**Date:** review pass against current HEAD

---

## Checklist Evidence

### 1. All 7 files modified correctly

| File | Status |
|---|---|
| `mobile/app.json` | ✅ expo-image-picker plugin added with `photosPermission` and `cameraPermission` strings; `android.permissions` includes `CAMERA` |
| `mobile/src/types/index.ts` | ✅ `photoBase64?: string` added to `IncidentDocument` |
| `dashboard/src/types/index.ts` | ✅ `photoBase64?: string` added to `IncidentDocument` |
| `mobile/src/services/incidentService.ts` | ✅ `photoBase64?: string` parameter added; conditionally spread into Firestore write |
| `mobile/src/screens/AlertScreen.tsx` | ✅ Photo UI implemented |
| `dashboard/src/components/IncidentDetailPanel.tsx` | ✅ Photo shown between Description and Location |
| `mobile/src/screens/TanodScreen.tsx` | ✅ Photo shown in expanded card |

### 2. Photo section placement in AlertScreen.tsx

Render order in the JSX: GPS card → Severity picker → Description input (`descSection`) → Photo section → Warning box → Alert button → Recent alerts. Confirmed by reading lines 221–280 of `AlertScreen.tsx`. **Pass.**

### 3. Photo state cleared after successful submission

After `await submitEmergencyAlert(...)` succeeds (`AlertScreen.tsx`, `onPress` handler), the code executes:
```ts
setDescription('');
setSeverity('moderate');
setPhotoBase64(null);
setPhotoUri(null);
```
Both `photoBase64` and `photoUri` are reset. **Pass.**

### 4. 900 KB base64 size guard and correct message

`processImageResult` in `AlertScreen.tsx`:
```ts
if (asset.base64.length > 900 * 1024) {
  Alert.alert(
    'Photo Too Large',
    'Photo is too large. Please retake with better lighting or closer to the subject.'
  );
  return;
}
```
Guard is present, threshold is 900 × 1024 characters, message is user-friendly. **Pass.**

### 5. Permissions requested before launching picker

`launchCamera`: calls `ImagePicker.requestCameraPermissionsAsync()`, checks `status !== 'granted'`, shows alert and returns early before `launchCameraAsync`.  
`launchLibrary`: calls `ImagePicker.requestMediaLibraryPermissionsAsync()`, same guard pattern.  
**Pass.**

### 6. Dashboard IncidentDetailPanel — photo between Description and Location

Body section order in `IncidentDetailPanel.tsx`: Description div → Photo div (conditional on `incident.photoBase64`) → Location div → Timeline div. **Pass.**

### 7. TanodScreen — photo in expanded card, correct style

Inside the `isExpanded` block of `renderIncident`:
```tsx
{item.photoBase64 && (
  <Image
    source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }}
    style={styles.incidentPhoto}
    resizeMode="cover"
  />
)}
```
`incidentPhoto` style: `{ width: '100%', height: 140, borderRadius: 10, marginTop: 8 }`. **Pass.**

### 8. TypeScript compiles clean on dashboard

`npx tsc --noEmit` in `dashboard/` → exit code 0, no output. **Pass.**

### 9. Tests pass

- Mobile Jest: 26 passed, 26 total (3 suites). **Pass.**
- Dashboard Vitest: 23 passed, 23 total (3 files). **Pass.**

### 10. No Firebase Storage used

Grep for `firebase/storage`, `getStorage`, `uploadBytes`, `getDownloadURL` across all 4 changed source files returned zero matches. Base64 is written directly to Firestore via `addDoc`. **Pass.**

### 11. `mediaTypes` value vs SDK 57 expo-image-picker API

The installed package is `expo-image-picker@57.0.21`. Its type definitions export:
```ts
export type MediaType = 'images' | 'videos' | 'livePhotos';
// mediaTypes?: MediaType | MediaType[] | MediaTypeOptions;
```
The code uses `mediaTypes: 'images'` (the string literal `MediaType`), which is the correct SDK 57 API. The old `MediaTypeOptions.Images` enum value is marked `@deprecated` in this version but would also still work; the code uses the new preferred form. **Pass.**

---

## Notes (non-blocking)

- `android.permissions` in `app.json` lists only `CAMERA`. The `expo-image-picker` plugin for SDK 57 (confirmed from `withImagePicker.js`) does **not** auto-inject `CAMERA` via the managed workflow plugin code — it only auto-injects `RECORD_AUDIO`. However, `CAMERA` is explicitly listed in `android.permissions`, which correctly covers camera capture. For Android 13+ photo library access (`READ_MEDIA_IMAGES`), the expo-image-picker plugin handles this via the system photo picker (MediaStore API) on API 33+, so no explicit `READ_MEDIA_IMAGES` entry is required in the managed workflow. This is correct.
- The `quality: 0.4` setting ensures most captures compress well below the 900 KB guard. The guard itself catches edge cases.
- No Firebase Storage is introduced anywhere in the codebase.
