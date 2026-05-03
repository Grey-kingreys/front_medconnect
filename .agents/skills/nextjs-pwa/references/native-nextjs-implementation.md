# Native Next.js PWA Implementation Guide

## Overview

This guide covers implementing PWA using Next.js built-in support (no external dependencies). Recommended for App Router projects with basic PWA requirements.

---

## Prerequisites

- Next.js 14+ (tested up to 16.x) with App Router (`/app` directory)
- Understanding of PWA concepts
- Basic knowledge of web manifests
- HTTPS deployment (required for production PWA)

---

## Step 1: Create Web App Manifest

**File Extension Options:** Next.js supports `manifest.json`, `manifest.webmanifest`, or `manifest.ts`. All formats are equally supported by browsers. Choose based on your preference:
- `.webmanifest` → W3C spec-recommended
- `.json` → Most common, widely supported
- `.ts` → Type-safe, dynamic generation

### Option A: Static Manifest (`app/manifest.webmanifest` or `app/manifest.json`)

```json
{
  "id": "/",
  "name": "Your App Name",
  "short_name": "App",
  "description": "Your app description",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshot1.png",
      "sizes": "540x720",
      "type": "image/png"
    }
  ]
}
```

### Option B: Dynamic Manifest (`app/manifest.ts`)

```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Your App Name',
    short_name: 'App',
    description: 'Your app description',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
```

**Dynamic Manifest Advantages:**
- Environment-based configuration
- TypeScript type safety
- Runtime value injection
- Conditional fields

**Example: Environment-based Manifest**
```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const isDev = process.env.NODE_ENV === 'development'
  
  return {
    name: isDev ? 'App (Dev)' : 'Your App Name',
    short_name: isDev ? 'App Dev' : 'App',
    description: 'Your app description',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: isDev ? '#ff0000' : '#000000',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
```

---

## Step 2: Create PWA Icons

Place icons in the `public/` directory:

```
public/
├── icon-192.png      (192x192 pixels)
├── icon-512.png      (512x512 pixels)
├── apple-icon.png    (180x180 pixels, optional)
└── favicon.ico       (optional)
```

**Icon Requirements:**
- **192x192px:** Minimum required size
- **512x512px:** Recommended for high-res displays
- **Format:** PNG (with transparency)
- **Purpose:** 
  - `any`: Standard icon
  - `maskable`: Adaptive icon (safe area in center)

**Tools for Icon Generation:**
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)

---

## Step 3: Add Metadata to Root Layout

Update `app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Your App Name',
  description: 'Your app description',
  manifest: '/manifest.webmanifest', // or '/manifest.json'
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Your App Name',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

**Key Metadata Fields:**
- `manifest`: Path to your manifest file
- `appleWebApp`: iOS-specific PWA settings
- `themeColor`: Browser UI color (matches manifest)
- `viewport`: Mobile viewport configuration

---

## Step 4: Test PWA Functionality

### Local Testing (Development)

1. **Run development server:**
```bash
npm run dev
```

2. **Open Chrome DevTools:**
   - Go to `Application` tab
   - Check `Manifest` section
   - Verify all fields are correct

3. **Test installability:**
   - Look for install prompt in browser
   - Click "Install" button

### Production Testing

1. **Build and serve:**
```bash
npm run build
npm run start
```

2. **Test on HTTPS:**
   - Deploy to Vercel, Netlify, or similar
   - Or use `ngrok` for local HTTPS testing

3. **Run Lighthouse audit:**
   - Chrome DevTools → Lighthouse tab
   - Select "Progressive Web App" category
   - Run audit

### Testing Checklist

- [ ] Manifest loads correctly
- [ ] Icons display properly
- [ ] Install prompt appears
- [ ] App installs successfully
- [ ] App opens in standalone mode
- [ ] Theme color applies correctly
- [ ] Lighthouse PWA score > 90

---

## Step 5: Optional Enhancements

### Add Offline Page (Manual Service Worker)

Create `public/sw.js`:

```javascript
const CACHE_NAME = 'offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL)
      })
    )
  }
})
```

Register in `app/layout.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export default function RootLayout({ children }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

Create `public/offline.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
  </style>
</head>
<body>
  <div>
    <h1>You're offline</h1>
    <p>Please check your internet connection.</p>
  </div>
</body>
</html>
```

### Add Install Prompt Component

Create `components/InstallPrompt.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  if (!showPrompt) return null

  return (
    <div className="install-prompt">
      <p>Install this app for a better experience!</p>
      <button onClick={handleInstall}>Install</button>
      <button onClick={() => setShowPrompt(false)}>Not now</button>
    </div>
  )
}
```

---

## Display Modes Explained

### `standalone` (Recommended)
- Looks like native app
- No browser UI
- Separate window
- Best user experience

### `fullscreen`
- Entire screen
- No status bar
- Best for games/immersive content

### `minimal-ui`
- Minimal browser controls
- Some navigation UI
- Middle ground

### `browser`
- Regular browser tab
- All browser UI
- Least app-like

---

## Icon Purpose Types

### `any` (Default)
- Standard icon
- Used in most contexts
- No special requirements

### `maskable`
- Adaptive icon for Android
- Safe area in center (80% of canvas)
- Prevents cropping
- [Maskable.app](https://maskable.app/) for testing

### `monochrome`
- Single-color icon
- For splash screens
- Optional

---

## Orientation Options

- `any`: No preference (default)
- `portrait`: Vertical only
- `portrait-primary`: Vertical, normal position
- `portrait-secondary`: Vertical, upside down
- `landscape`: Horizontal only
- `landscape-primary`: Horizontal, normal position
- `landscape-secondary`: Horizontal, rotated

---

## Common Issues & Solutions

### Issue 1: Install Prompt Not Appearing
**Causes:**
- Not on HTTPS
- Already installed
- Manifest errors
- Missing required fields

**Solution:**
- Deploy to HTTPS domain
- Clear site data and test again
- Validate manifest in DevTools
- Ensure all required fields present

### Issue 2: Icons Not Displaying
**Causes:**
- Incorrect file paths
- Wrong icon sizes
- Invalid image format

**Solution:**
- Verify icons in `public/` directory
- Check paths in manifest (should start with `/`)
- Use PNG format
- Validate sizes (192x192, 512x512)

### Issue 3: Theme Color Not Applying
**Causes:**
- Mismatch between manifest and metadata
- Browser caching

**Solution:**
- Ensure `theme_color` in manifest matches `themeColor` in metadata
- Clear cache and test again

### Issue 4: App Opens in Browser Instead of Standalone
**Causes:**
- `display` not set to `standalone`
- App not properly installed

**Solution:**
- Set `display: "standalone"` in manifest
- Uninstall and reinstall app

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| **Manifest** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Icons** | ✅ Full | ✅ Full | ⚠️ Partial | ✅ Full |
| **Install Prompt** | ✅ Yes | ❌ No | ⚠️ Manual | ✅ Yes |
| **Standalone Mode** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Theme Color** | ✅ Yes | ✅ Yes | ⚠️ Limited | ✅ Yes |

**Notes:**
- Safari: Add to Home Screen from share menu
- Firefox: Install from address bar menu
- All major browsers support basic PWA features

---

## Deployment Checklist

- [ ] Manifest file created and valid
- [ ] Icons generated (192x192, 512x512)
- [ ] Metadata added to root layout
- [ ] HTTPS enabled
- [ ] Lighthouse PWA audit passed
- [ ] Tested on mobile devices
- [ ] Install prompt tested
- [ ] Standalone mode verified
- [ ] Theme color correct
- [ ] Start URL correct

---

## Production Best Practices

1. **Always use HTTPS** (required for PWA)
2. **Provide multiple icon sizes** (192x192, 512x512 minimum)
3. **Test on real devices** (not just desktop browser)
4. **Use meaningful app name** (shows in app launcher)
5. **Set appropriate theme color** (matches brand)
6. **Add screenshots** (helps with app stores)
7. **Use `maskable` icons** (better Android experience)
8. **Test offline behavior** (even without service worker)

---

## Next Steps

After implementing native PWA:

1. **Monitor installation rates** using analytics
2. **Consider Serwist** if you need offline functionality
3. **Add push notifications** (requires service worker)
4. **Implement background sync** (requires service worker)
5. **Optimize for app stores** (Google Play, Microsoft Store)

---

## When to Upgrade to Serwist

Consider upgrading if you need:
- ✅ Offline functionality
- ✅ Advanced caching strategies
- ✅ Background sync
- ✅ Push notifications
- ✅ Service worker automation

Native PWA is sufficient for:
- ✅ Installability only
- ✅ Simple web apps
- ✅ Mostly-online experiences
- ✅ Zero-dependency requirement

---

## Resources

- **Next.js Manifest Docs:** https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- **MDN Web App Manifest:** https://developer.mozilla.org/en-US/docs/Web/Manifest
- **web.dev PWA Guide:** https://web.dev/progressive-web-apps/
- **Maskable Icons:** https://maskable.app/
- **PWA Builder:** https://www.pwabuilder.com/

---

**Last Updated:** November 13, 2025
**Tested With:** Next.js 14.x - 16.x