<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { normalizeScanTag, scanNfc } from "./util";
  import { devNotiStore, notificationStore } from "./stores";
  import { t } from "$lib/i18n";

  const dispatch = createEventDispatcher();
  const SCAN_TIMEOUT = 8;

  export let disabled = false;
  let scanning = false;
  let cancelScan: (() => void) | null = null;

  async function scan() {
    devNotiStore.set("Scanning");
    scanning = true;
    const [cancel, scanPromise] = scanNfc({ timeOutSecs: SCAN_TIMEOUT });
    cancelScan = cancel;

    const scanResult = await scanPromise;
    devNotiStore.set("Scan result in: " + scanResult);
    // Only emit if we didnt cancel in the meantime
    if (scanResult != null) {
      const normalizedTag = normalizeScanTag(scanResult);
      devNotiStore.set("Dispatching scan result " + normalizedTag);
      dispatch("scanned", { result: normalizedTag });
      msg = normalizedTag || $t("scan.unknown");
    }
    scanning = false;
  }

  function cancel() {
    if (cancelScan != null) {
      cancelScan();
      scanning = false;
    }
  }

  let msg = "";
</script>

<button
  on:click={() => (scanning ? cancel() : scan())}
  class="border h-16 px-6 text-lg border-green-600 disabled:text-gray-400 min-w-[12rem]"
  class:scanning
  {disabled}
>
  {#if scanning}
    {$t("scan.scanning")} <br /><span class="text-xs">{$t("scan.cancel")}</span>
  {:else}
    {$t("scan.action")}
  {/if}</button
>
<br />
{msg}

<style>
  button {
    width: min(100%, 18rem);
    min-width: min(12rem, 100%);
    border-radius: 12px;
    font-weight: 800;
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
