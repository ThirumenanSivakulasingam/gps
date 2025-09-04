# Vercel Deployment Guide

## Prerequisites
- Vercel account (free tier available)
- GitHub repository with your code

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your repository
5. Vercel will auto-detect it's a Vite project
6. Click "Deploy"

### 3. Configuration
The following files are already configured:
- `vercel.json` - Vercel configuration
- `vite.config.js` - Build optimization
- `package.json` - Build scripts

### 4. Environment Variables (Optional)
If you need environment variables, add them in Vercel dashboard:
- Go to your project settings
- Navigate to "Environment Variables"
- Add any required variables

## Important Notes

### Geolocation
- ✅ **HTTPS Required**: Vercel provides HTTPS by default
- ✅ **Geolocation will work** on deployed version
- ✅ **Location permissions** will be requested from users

### File Serving
- ✅ **SVG files** are properly served from `/public` directory
- ✅ **Static assets** are optimized and cached
- ✅ **Build output** is in `/dist` directory

### Performance
- ✅ **Code splitting** configured for better loading
- ✅ **Asset optimization** enabled
- ✅ **Gzip compression** handled by Vercel

## Testing Locally
```bash
npm run build
npm run preview
```

## Troubleshooting

### If geolocation doesn't work:
1. Check browser console for errors
2. Ensure HTTPS is enabled (Vercel provides this)
3. Check browser location permissions

### If SVG doesn't load:
1. Verify `map.svg` is in `/public` directory
2. Check network tab for 404 errors
3. Ensure path is `/map.svg` (not relative)

### Build issues:
1. Run `npm run build` locally first
2. Check for any TypeScript/ESLint errors
3. Ensure all dependencies are in `package.json`
