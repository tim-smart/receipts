/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"

declare let self: ServiceWorkerGlobalScope

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (e) => {
  console.log("SW fetch", e.request)
})

registerRoute(
  ({ url }) => url.pathname === "/share",
  async (event) => {
    const data = await event.request.formData()
    const image = data.get("images")
    if (image instanceof File) {
      const cache = await caches.open("receipts")
      await cache.put(new Request("/share"), new Response(image))
    }
    return Response.redirect("/")
  },
  "POST",
)

// self.__WB_MANIFEST is default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")))
