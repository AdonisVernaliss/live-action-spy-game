import { writable } from "svelte/store";

export type WakeLockStatus =
  | "unsupported"
  | "inactive"
  | "requesting"
  | "active"
  | "denied";

type WakeLockSentinelLike = EventTarget & {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export const wakeLockStatus = writable<WakeLockStatus>("inactive");

let desired = false;
let sentinel: WakeLockSentinelLike | null = null;
let initialized = false;

async function releaseWakeLock() {
  const current = sentinel;
  sentinel = null;
  if (current != null && !current.released) {
    try {
      await current.release();
    } catch {
      // A browser may release it automatically when the page becomes hidden.
    }
  }
  wakeLockStatus.set("inactive");
}

async function requestWakeLock() {
  if (typeof navigator === "undefined" || typeof document === "undefined") return;
  const wakeLock = (navigator as WakeLockNavigator).wakeLock;
  if (wakeLock == null) {
    wakeLockStatus.set("unsupported");
    return;
  }
  if (!desired || document.visibilityState !== "visible" || sentinel != null) {
    return;
  }

  wakeLockStatus.set("requesting");
  try {
    const next = await wakeLock.request("screen");
    if (!desired) {
      await next.release();
      wakeLockStatus.set("inactive");
      return;
    }
    sentinel = next;
    wakeLockStatus.set("active");
    next.addEventListener("release", () => {
      if (sentinel === next) sentinel = null;
      wakeLockStatus.set("inactive");
    });
  } catch {
    wakeLockStatus.set("denied");
  }
}

export function setWakeLockDesired(nextDesired: boolean) {
  desired = nextDesired;
  if (desired) void requestWakeLock();
  else void releaseWakeLock();
}

export function startWakeLockManager() {
  if (initialized || typeof document === "undefined") return () => {};
  initialized = true;

  const refresh = () => {
    if (document.visibilityState === "visible" && desired) {
      void requestWakeLock();
    }
  };
  const retryAfterInteraction = () => {
    if (desired && sentinel == null) void requestWakeLock();
  };

  document.addEventListener("visibilitychange", refresh);
  document.addEventListener("pointerdown", retryAfterInteraction, {
    passive: true,
  });

  return () => {
    initialized = false;
    desired = false;
    document.removeEventListener("visibilitychange", refresh);
    document.removeEventListener("pointerdown", retryAfterInteraction);
    void releaseWakeLock();
  };
}
