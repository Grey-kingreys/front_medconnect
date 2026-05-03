# Serwist PWA Implementation Guide

## Overview

Comprehensive guide for implementing advanced PWA features using Serwist with Next.js. Provides robust offline functionality, caching strategies, and service worker management.

---

## Prerequisites

- Next.js 13+ (App Router or Pages Router)
- Node.js 18.0.0+ (22.x recommended for 2025)
- TypeScript 5.0.0+ (if using TypeScript)
- Understanding of service workers
- Basic PWA knowledge

## Version Information (Updated November 2025)

- **Serwist Latest Stable:** 9.2.1+
- **Preview Version:** 10.0.0-preview (in active development)
- **Breaking Changes:** v9.0.0 introduced major API changes (March 2024)
- **Next.js Compatibility:** 13+ (tested up to 16.x)

---

## Installation

### Install Dependencies

```bash
npm i @serwist/next && npm i -D serwist
# or
yarn add @serwist/next && yarn add -D serwist
# or
pnpm add @serwist/next && pnpm add -D serwist
```

### Package Information
- **@serwist/next**: Next.js integration (runtime dependency)
- **serwist**: Core service worker library (dev dependency)

**Important:** Since v9.0.0, Serwist consolidated multiple packages into one. You no longer need separate packages for routing, precaching, or strategies.

---

## Turbopack Compatibility (November 2025)

**Status Update:**

✅ **Production builds** (`next build`): **Fully compatible** with Turbopack
⚠️ **Development** (`next dev --turbo`): Shows warning but **fully functional**

### Development Warning Solution

**Option 1: Suppress Warning (Recommended)**
```bash
# Add to .env.local
SERWIST_SUPPRESS_TURBOPACK_WARNING="1"
```

**Option 2: Use Webpack in Development**
```bash
npm run dev -- --webpack
```

**Important Notes:**
- The `--webpack` flag is **NOT required** for production builds
- Serwist works natively with Turbopack in production
- The warning in development is informational, not an error
- Your app will function normally even with the warning

---

## Step 1: Configure Next.js

Update `next.config.js` (or `next.config.mjs`):

### ESM Syntax (Recommended for Next.js 13+)

```javascript
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development', // Optional
})

export default withSerwist({
  // Your Next.js config
  reactStrictMode: true,
  // ... other settings
})
```

### CommonJS Syntax

```javascript
const withSerwist = require('@serwist/next').default({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
})

module.exports = withSerwist({
  reactStrictMode: true,
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `swSrc` | `string` | Required | Path to service worker source file |
| `swDest` | `string` | Required | Output path for compiled service worker |
| `cacheOnNavigation` | `boolean` | `false` | Cache pages on navigation |
| `reloadOnOnline` | `boolean` | `false` | Reload when coming back online |
| `disable` | `boolean` | `false` | Disable service worker (useful for dev) |
| `scope` | `string` | `'/'` | Service worker scope |
| `register` | `boolean` | `true` | Auto-register service worker |

---

## Step 2: Create Service Worker

Create `app/sw.ts` (or `src/sw.ts` if using src directory):

```typescript
import { Serwist } from 'serwist'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Google Fonts
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    // Font Files
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    // Images
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    // Next.js Image Optimization
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    // JavaScript Files
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    // CSS Files
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    // Next.js Data
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    // API Routes
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'apis',
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Fallback for Everything Else
    {
      urlPattern: /.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})

serwist.addEventListeners()
```

**Important:** The `serwist.addEventListeners()` call is **required** in v9.0.0+. Without it, the service worker won't function.

---

## Step 3: Register Service Worker

### App Router (`app/layout.tsx`)

```tsx
'use client'

import { useEffect } from 'react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registered:', registration)
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }
  }, [])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### Pages Router (`pages/_app.tsx`)

```tsx
import { useEffect } from 'react'
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  return <Component {...pageProps} />
}
```

---

## Step 4: Create Web App Manifest

Create `app/manifest.ts`:

```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Your App Name',
    short_name: 'App',
    description: 'Your app description',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
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

Add to `app/layout.tsx`:

```tsx
export const metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Your App Name',
  },
}
```

---

## Step 5: Update TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
    "types": ["@serwist/next/typings"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", "app/sw.ts"],
  "exclude": ["node_modules"]
}
```

**Key additions:**
- `"webworker"` in `lib` (for service worker APIs)
- `"@serwist/next/typings"` in `types` (for Serwist types)
- `"app/sw.ts"` in `include` (to compile service worker)

---

## Caching Strategies Explained

### 1. **CacheFirst** (Cache Falling Back to Network)
```typescript
{
  handler: 'CacheFirst',
  options: {
    cacheName: 'my-cache',
    expiration: {
      maxEntries: 50,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
    },
  },
}
```
- **Use for:** Static assets, fonts, images
- **Flow:** Cache → Network (if not in cache)
- **Best for:** Unchanging resources

### 2. **NetworkFirst** (Network Falling Back to Cache)
```typescript
{
  handler: 'NetworkFirst',
  options: {
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    expiration: {
      maxEntries: 50,
      maxAgeSeconds: 5 * 60, // 5 minutes
    },
  },
}
```
- **Use for:** API calls, dynamic content
- **Flow:** Network → Cache (if network fails)
- **Best for:** Fresh data with offline fallback

### 3. **StaleWhileRevalidate** (Cache + Background Update)
```typescript
{
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'assets-cache',
    expiration: {
      maxEntries: 100,
      maxAgeSeconds: 24 * 60 * 60, // 1 day
    },
  },
}
```
- **Use for:** Frequently updated content
- **Flow:** Cache (instant) → Network (update in background)
- **Best for:** Balance between speed and freshness

### 4. **NetworkOnly** (Always Network)
```typescript
{
  handler: 'NetworkOnly',
}
```
- **Use for:** Always-fresh data
- **Flow:** Network only (no cache)
- **Best for:** Critical real-time data

### 5. **CacheOnly** (Always Cache)
```typescript
{
  handler: 'CacheOnly',
}
```
- **Use for:** Pre-cached resources
- **Flow:** Cache only (no network)
- **Best for:** App shell, critical assets

---

## Advanced Features

### Offline Fallback Page

```typescript
const serwist = new Serwist({
  // ... other config
  offlineFallbackPage: '/offline',
  runtimeCaching: [
    // ... other caching rules
  ],
})

serwist.addEventListeners()
```

Create `app/offline/page.tsx`:

```tsx
export default function OfflinePage() {
  return (
    <div>
      <h1>You're offline</h1>
      <p>Please check your internet connection.</p>
    </div>
  )
}
```

### Background Sync

```typescript
// In sw.ts
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData())
  }
})

async function syncData() {
  // Sync logic here
}
```

Register sync in your app:

```typescript
if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
  navigator.serviceWorker.ready.then((registration) => {
    return registration.sync.register('sync-data')
  })
}
```

### Push Notifications

```typescript
// Request permission
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    console.log('Notification permission granted')
  }
}

// Subscribe to push
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY',
  })
  // Send subscription to server
}
```

---

## Breaking Changes: v9.0.0

**Critical:** If migrating from v8.x or earlier, note these changes:

### 1. Import Changes
```typescript
// ❌ OLD (v8.x)
import { installSerwist } from '@serwist/sw'

// ✅ NEW (v9.0.0+)
import { Serwist } from 'serwist'
```

### 2. Initialization Changes
```typescript
// ❌ OLD
const sw = installSerwist({ /* config */ })

// ✅ NEW
const serwist = new Serwist({ /* config */ })
serwist.addEventListeners() // Required!
```

### 3. Package Consolidation
```bash
# ❌ OLD
npm i @serwist/precaching @serwist/routing @serwist/strategies

# ✅ NEW
npm i -D serwist
```

### 4. Configuration Structure
Most configuration options remain the same, but initialization syntax changed.

---

## Testing

### Development Testing

```bash
# Build the app
npm run build

# Start production server
npm run start

# Test in browser
open http://localhost:3000
```

### Service Worker DevTools

1. Open Chrome DevTools
2. Go to `Application` → `Service Workers`
3. Verify service worker is registered and activated
4. Test offline by checking "Offline" checkbox

### Cache Inspection

1. DevTools → `Application` → `Cache Storage`
2. Inspect cached files
3. Verify caching strategies working

---

## Common Issues & Solutions

### Issue 1: Service Worker Not Registering
**Solution:**
- Ensure you're on HTTPS (or localhost)
- Check console for errors
- Verify `sw.js` is in `public/` directory

### Issue 2: Cache Not Updating
**Solution:**
- Set `skipWaiting: true` in Serwist config
- Clear cache manually
- Implement versioning

### Issue 3: TypeScript Errors in sw.ts
**Solution:**
- Add `"webworker"` to `lib` in tsconfig.json
- Add `"@serwist/next/typings"` to `types`
- Include `app/sw.ts` in tsconfig

### Issue 4: Turbopack Warning in Development
**Solution:**
- Add `SERWIST_SUPPRESS_TURBOPACK_WARNING="1"` to `.env.local`
- Or use `npm run dev -- --webpack`
- **Note:** This is only a warning, app still works

---

## Production Checklist

- [ ] Serwist packages installed
- [ ] `next.config.js` configured
- [ ] Service worker created (`app/sw.ts`)
- [ ] Service worker registered in layout
- [ ] TypeScript configuration updated
- [ ] Web app manifest created
- [ ] Icons added to `public/`
- [ ] Tested in production build
- [ ] HTTPS enabled
- [ ] Caching strategies appropriate
- [ ] Offline fallback implemented (if needed)
- [ ] Service worker updates tested

---

## Resources

- **Serwist Documentation:** https://serwist.pages.dev
- **Serwist GitHub:** https://github.com/serwist/serwist
- **Migration Guide:** https://serwist.pages.dev/docs/migration
- **Next.js PWA Guide:** https://nextjs.org/docs/app/building-your-application/configuring/progressive-web-apps

---

**Last Updated:** November 13, 2025
**Tested With:** Next.js 14.x - 16.x, Serwist 9.2.1+