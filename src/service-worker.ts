/// <reference lib="webworker" />

import { build, files, prerendered, version } from "$service-worker";

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE_PREFIX = "protocol-150-";
const CACHE_NAME = `${CACHE_PREFIX}${version}`;
const APP_SHELL = [...build, ...files, ...prerendered];
const IMMUTABLE_ASSETS = new Set([...build, ...files]);

worker.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
  );
});

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== worker.location.origin) {
    return;
  }

  // Game state must always come from Socket.IO and must never be cached.
  if (url.pathname.startsWith("/socket.io/")) {
    return;
  }

  if (IMMUTABLE_ASSETS.has(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request, { ignoreSearch: true }).then(
          (cached) =>
            cached ??
            new Response("Приложение недоступно без сети. Откройте его один раз онлайн. / The app is unavailable offline. Open it online once first.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
        )
      )
    );
  }
});
