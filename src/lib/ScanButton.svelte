<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { onDestroy } from "svelte";
  import { normalizeScanTag, scanNfc } from "./util";
  import { devNotiStore } from "./stores";
  import { t } from "$lib/i18n";

  const dispatch = createEventDispatcher();
  const SCAN_TIMEOUT = 8;
  const HOLD_TO_SCAN_MS = 420;

  export let disabled = false;
  let scanning = false;
  let cancelScan: (() => void) | null = null;
  let scanAttempt = 0;
  let activePointerId: number | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdMode = false;
  let suppressNextClick = false;
  let msg = "";

  async function startScan() {
    if (disabled || scanning) return;
    const attempt = ++scanAttempt;
    devNotiStore.set("Scanning");
    scanning = true;
    msg = "";
    const [cancel, scanPromise] = scanNfc({ timeOutSecs: SCAN_TIMEOUT });
    cancelScan = cancel;

    const scanResult = await scanPromise;
    if (attempt !== scanAttempt) return;

    devNotiStore.set("Scan result in: " + scanResult);
    if (scanResult != null) {
      const normalizedTag = normalizeScanTag(scanResult);
      devNotiStore.set("Dispatching scan result " + normalizedTag);
      dispatch("scanned", { result: normalizedTag });
      msg = normalizedTag || $t("scan.unknown");
    }
    scanning = false;
    cancelScan = null;
  }

  function cancelScanning() {
    cancelScan?.();
    cancelScan = null;
    scanAttempt += 1;
    scanning = false;
  }

  function toggleScan() {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (disabled) return;
    if (scanning) cancelScanning();
    else startScan();
  }

  function clearHoldTimer() {
    if (holdTimer != null) clearTimeout(holdTimer);
    holdTimer = null;
  }

  function beginHold(event: PointerEvent) {
    if (disabled || activePointerId != null || event.button !== 0) return;
    activePointerId = event.pointerId;
    holdMode = false;
    (event.currentTarget as HTMLButtonElement).setPointerCapture?.(
      event.pointerId
    );
    holdTimer = setTimeout(() => {
      if (activePointerId !== event.pointerId) return;
      holdMode = true;
      suppressNextClick = true;
      if (!scanning) startScan();
    }, HOLD_TO_SCAN_MS);
  }

  function finishHold(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    clearHoldTimer();
    activePointerId = null;

    if (holdMode) {
      holdMode = false;
      if (scanning) cancelScanning();
      // A click is dispatched after pointerup. Suppress only that synthetic
      // click so the next deliberate tap still works.
      suppressNextClick = true;
      setTimeout(() => (suppressNextClick = false), 0);
    }
  }

  function cancelHold(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    clearHoldTimer();
    activePointerId = null;
    if (holdMode && scanning) cancelScanning();
    holdMode = false;
    suppressNextClick = false;
  }

  onDestroy(() => {
    clearHoldTimer();
    if (scanning) cancelScanning();
  });
</script>

<button
  type="button"
  data-scan-button
  on:click={toggleScan}
  on:pointerdown={beginHold}
  on:pointerup={finishHold}
  on:pointercancel={cancelHold}
  on:contextmenu|preventDefault
  class="border h-16 px-6 text-lg border-green-600 disabled:text-gray-400 min-w-[12rem]"
  class:scanning
  aria-pressed={scanning}
  {disabled}
>
  {#if scanning}
    {$t("scan.scanning")} <br /><span class="text-xs">{$t("scan.cancel")}</span>
  {:else}
    {$t("scan.action")}
  {/if}</button
>
{#if msg}
  <p class="scan-result">{msg}</p>
{/if}

<style>
  button {
    width: min(100%, 18rem);
    min-width: min(12rem, 100%);
    border-radius: 12px;
    font-weight: 800;
    touch-action: manipulation;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .scan-result {
    max-width: min(100%, 18rem);
    margin: 6px 0 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 10px;
    line-height: 1.35;
    overflow-wrap: anywhere;
    text-align: center;
  }

  @keyframes gradientAnimation {
    0% {
      background-position: 0% 0%;
    }

    50% {
      background-position: 100% 100%;
    }

    100% {
      background-position: 200% 200%;
    }
  }

  .scanning {
    background-image: linear-gradient(
      to right,
      rgb(34, 197, 94),
      rgb(21, 128, 61),
      rgb(20, 83, 45)
    );
    background-size: 300% 100%;
    animation: gradientAnimation 2s linear infinite;
  }
</style>
