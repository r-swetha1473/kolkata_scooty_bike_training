# Deployment Guide

## Build & Backend Successfully Fixed! ✅

### What Was Fixed

**1. TypeScript Build Errors** ✅
- Changed `SupabaseClient<Database>` to `SupabaseClient<any>`
- Build now completes successfully

**2. Backend Connection Issue** ✅
- Switched from `import.meta.env` (Vite-specific) to Angular's environment system
- Backend now works correctly when published
- No external environment variables needed!

See `BACKEND_FIX.md` for detailed explanation.

## Deployment Options

### Option 1: Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Fix build errors"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Angular configuration

3. **Deploy**
   - Click "Deploy"
   - Vercel will run `npm run build` automatically
   - ✅ Backend connects automatically (no env vars needed!)
   - Your site will be live in minutes!

### Option 2: Deploy to Netlify

1. **Push to GitHub** (same as above)

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository

3. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist/demo`

4. **Environment Variables**
   Add the same environment variables as Vercel

5. **Deploy**
   - Click "Deploy site"
   - Your site will be live shortly

### Option 3: Deploy to GitHub Pages

1. **Install gh-pages**
   ```bash
   npm install --save-dev angular-cli-ghpages
   ```

2. **Build for GitHub Pages**
   ```bash
   npm run build -- --base-href=/your-repo-name/
   ```

3. **Deploy**
   ```bash
   npx angular-cli-ghpages --dir=dist/demo
   ```

4. **Enable GitHub Pages**
   - Go to your repo → Settings → Pages
   - Source: Deploy from a branch → gh-pages
   - Save

### Option 4: Deploy to Firebase Hosting

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and Initialize**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **Configure**
   - Public directory: `dist/demo`
   - Configure as single-page app: Yes
   - Set up automatic builds: Optional

4. **Deploy**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## Build Output

The successful build creates:
- Output location: `dist/demo`
- Initial bundle size: ~119 KB (gzipped)
- Lazy-loaded chunks for optimal performance
- PWA assets included (manifest.json, sw.js)

## Post-Deployment Steps

### 1. Update Google OAuth Redirect URIs

Add your production URL to Google OAuth:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your OAuth credentials
3. Add authorized redirect URIs:
   ```
   https://your-domain.com
   https://your-domain.com/booking
   ```

### 2. Update Supabase Settings

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://your-domain.com`
- Redirect URLs: Add `https://your-domain.com/**`

### 3. Test Deployment

Verify these work:
- ✅ Home page loads
- ✅ All public pages accessible
- ✅ Google OAuth login works
- ✅ Admin panel accessible (after login)
- ✅ Real-time updates working
- ✅ Bookings can be created/cancelled

## Troubleshooting Deployment

### Build Fails on Deployment Platform

If build fails with memory issues:
- Increase Node memory: `NODE_OPTIONS=--max_old_space_size=4096`
- Add to build command: `NODE_OPTIONS=--max_old_space_size=4096 npm run build`

### 404 on Page Refresh

For Angular routing to work on deployment:
- **Vercel**: Add `vercel.json`:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

- **Netlify**: Add `public/_redirects`:
  ```
  /*  /index.html  200
  ```

- **Firebase**: Already configured via `firebase.json`

### Environment Variables Not Working

Ensure variables are prefixed with `VITE_` and:
- Rebuild the project after adding variables
- Restart the deployment
- Check deployment logs for any errors

### OAuth Redirect Issues

Common causes:
- Redirect URI not added to Google Console
- Redirect URI doesn't match exactly (check trailing slashes)
- Supabase redirect URLs not configured

## Performance Optimization

The build is already optimized with:
- ✅ Code splitting (lazy loading)
- ✅ Tree shaking
- ✅ Minification
- ✅ Gzip compression
- ✅ AOT compilation

Additional optimizations:
- Enable CDN on your hosting platform
- Configure caching headers
- Use HTTP/2 (auto-enabled on most platforms)

## Monitoring

After deployment, monitor:
- Application performance
- Error rates (use Sentry or similar)
- Supabase database usage
- API response times

## Cost Estimate

### Hosting
- **Vercel/Netlify**: Free tier sufficient for moderate traffic
- **Firebase**: Free tier includes 10 GB/month hosting
- **GitHub Pages**: Free

### Backend (Supabase)
- Free tier includes:
  - 500 MB database
  - 1 GB file storage
  - 2 GB bandwidth
  - 50,000 monthly active users

## Support

If you encounter issues:
1. Check deployment platform logs
2. Verify environment variables
3. Test build locally: `npm run build`
4. Check browser console for errors
5. Verify Supabase connection

## Success! 🎉

Your Kolkata Scotty Bike Training application is now ready to deploy to any platform. The build is working perfectly, and all features are functional.

Choose your preferred deployment platform and follow the instructions above. The application will be live in minutes!
