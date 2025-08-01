import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate, NetworkFirst, CacheFirst, ExpirationPlugin, RangeRequestsPlugin } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

// Optimized caching strategies for 1-week offline capability
const customRuntimeCaching = [
  // External list URLs: NetworkFirst for fresh content, 1-week offline fallback
  {
    matcher: ({ url }: { url: URL }) =>
      url.hostname === 'raw.githubusercontent.com' ||
      url.hostname === 'gist.githubusercontent.com' ||
      url.hostname === 'api.codetabs.com' ||
      url.hostname === 'corsproxy.io' ||
      url.hostname === 'api.allorigins.win',
    handler: new NetworkFirst({
      cacheName: 'external-lists',
      networkTimeoutSeconds: 5, // Quick timeout to avoid slow loading
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
          maxAgeFrom: "last-used"
        })
      ]
    })
  },
  // FxTwitter API responses: 1-week caching with reasonable limits
  {
    matcher: ({ url }: { url: URL }) => url.hostname === 'api.fxtwitter.com',
    handler: new StaleWhileRevalidate({
      cacheName: 'fxtwitter-api',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
          maxAgeFrom: "last-used"
        })
      ]
    })
  },
  // Twitter images: 1-week storage-conscious caching
  {
    matcher: ({ url }: { url: URL }) =>
      url.hostname === 'pbs.twimg.com',
    handler: new CacheFirst({
      cacheName: 'twitter-images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 400,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
          maxAgeFrom: "last-used"
        })
      ]
    })
  },
  // Twitter videos: Works on Safari and Chromium but not Brave
  {
    matcher: ({ url }: { url: URL }) => url.hostname === 'video.twimg.com',
    handler: new CacheFirst({
      cacheName: 'twitter-videos',
      plugins: [
        new RangeRequestsPlugin(),
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60,
          maxAgeFrom: "last-used"
        })
      ]
    })
  },
  // Include default caching strategies for other content
  ...defaultCache
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: customRuntimeCaching,
});

serwist.addEventListeners();