# Clear Browser Cache - Fix "Environment variable not defined" Error

## The Issue

If you see this error:
```
ERROR Error: Environment variable VITE_SUPABASE_URL is not defined
```

This is because your browser is loading **old cached files** from before the fix.

## The Solution

You need to clear your browser cache and force a fresh build.

### Step 1: Clean Build Locally

```bash
# Remove old build files
rm -rf dist/

# Rebuild
npm run build

# Output should show: "Application bundle generation complete"
```

### Step 2: Clear Browser Cache

**Chrome/Edge:**
1. Press `F12` (open DevTools)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Firefox:**
1. Press `Ctrl+Shift+Delete`
2. Check "Cache"
3. Click "Clear Now"
4. Then `Ctrl+F5` to hard refresh

**Safari:**
1. Press `Cmd+Option+E` (empty caches)
2. Then `Cmd+Shift+R` (hard refresh)

### Step 3: Test Locally

```bash
# Start dev server
npm start

# Visit http://localhost:4200
# Should work without errors
```

### Step 4: For Deployed Site

If you've already deployed:

**Vercel/Netlify:**
1. Go to your deployment dashboard
2. Click "Redeploy" or "Trigger Deploy"
3. This will build with the new code
4. Clear your browser cache
5. Visit your site

**GitHub Pages:**
```bash
# Rebuild and redeploy
npm run build
npx angular-cli-ghpages --dir=dist/demo/browser
```

## Why This Happened

### Before Fix
- Code used `import.meta.env` to get environment variables
- This worked in dev but failed in production
- Browser cached these old files

### After Fix
- Code uses Angular's `environment.ts`
- Credentials compiled into the bundle
- New build doesn't have the error

## Verify the Fix

After clearing cache, check browser console:

**Should NOT see:**
- ❌ "Environment variable VITE_SUPABASE_URL is not defined"
- ❌ "getEnvVar" errors

**Should see:**
- ✅ Normal app startup
- ✅ Successful Supabase connection
- ✅ No environment variable errors

## Check Built Files

To verify the new code is in the build:

```bash
# Check if old code exists (should be empty)
grep -r "getEnvVar" dist/demo/browser/*.js

# Check if Supabase URL is compiled in (should show results)
grep -r "cogzshqrbuzhvstvjpso" dist/demo/browser/*.js
```

**Expected results:**
- ✅ No `getEnvVar` found
- ✅ Supabase URL found (compiled into bundle)

## Still Having Issues?

### 1. Check Source Files

Make sure `src/app/services/supabase.service.ts` has:

```typescript
import { environment } from '../../environments/environment';

constructor() {
  this.supabase = createClient<any>(
    environment.supabaseUrl,
    environment.supabaseAnonKey
  );
}
```

**Should NOT have:**
```typescript
// ❌ OLD CODE - Should be removed
private getEnvVar(key: string): string {
  const value = (import.meta as any).env?.[key];
  ...
}
```

### 2. Check Environment Files Exist

```bash
ls src/environments/
# Should show:
# environment.ts
# environment.prod.ts
```

### 3. Rebuild from Scratch

```bash
# Remove everything
rm -rf dist/ node_modules/

# Reinstall
npm install

# Rebuild
npm run build
```

### 4. Check Browser Console

Press F12 → Console tab

Look for:
- Network requests to Supabase (should be successful)
- No "environment variable" errors
- App loads normally

## For Deployment Platforms

### Vercel
1. Push code to GitHub
2. Vercel auto-deploys
3. Clear browser cache
4. Visit site

### Netlify
1. Push code to GitHub
2. Netlify auto-deploys
3. Clear browser cache
4. Visit site

### Manual Deploy
```bash
# Build
npm run build

# The dist/demo/browser folder now has the fixed code
# Deploy this folder to your hosting platform
```

## Success Indicators

✅ Build completes without errors
✅ No console errors about environment variables
✅ Supabase URL found in built files
✅ Browser shows app without errors
✅ Can sign in with Google OAuth
✅ Can create bookings

## Summary

The fix is already in your code. You just need to:
1. **Clear browser cache** (most important!)
2. **Rebuild** if testing locally
3. **Redeploy** if already published

The error is from old cached files, not from the current code.
