<script lang="ts">
  import { dev } from "$lib/consts";
  import {
    VIRUS_FAIL_TIME,
    VIRUS_SCAN_PREPARE_SECS,
    VIRUS_SCAN_TIME,
  } from "$lib/consts";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction } from "$lib/websocket";
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";
  let x_diff: number, y_diff: number, z_diff: number;
  let hasAccelerometer = false;
  let moved = false;
  let overallMovement = 0;
  let prepareInterval: ReturnType<typeof setInterval> | null = null;
  let scanInterval: ReturnType<typeof setInterval> | null = null;
  let penaltyInterval: ReturnType<typeof setInterval> | null = null;
  let sensorInterval: ReturnType<typeof setInterval> | null = null;
  let accelerometer: Accelerometer | null = null;

  let scanFailedCounter = VIRUS_FAIL_TIME;
  function virusScanFailed() {
    emitGameAction({ action: "virusScanFailed" });
    penaltyInterval = setInterval(() => {
      scanFailedCounter -= 1;
      if (scanFailedCounter === 0) {
        if (penaltyInterval != null) clearInterval(penaltyInterval);
        penaltyInterval = null;
        gotoReplace("/game");
      }
    }, 1000);
  }

  let virusScanCounter = VIRUS_SCAN_TIME;
  function startVirusScan() {
    scanInterval = setInterval(() => {
      virusScanCounter -= 1;
      if (moved) {
        if (scanInterval != null) clearInterval(scanInterval);
        scanInterval = null;
        virusScanFailed();
        return;
      }

      if (virusScanCounter === 0) {
        if (scanInterval != null) clearInterval(scanInterval);
        scanInterval = null;
        gotoReplace("/game");
      }
    }, 1000);
  }

  let beforeStartCounter = VIRUS_SCAN_PREPARE_SECS;
  onMount(() => {
    hasAccelerometer = "Accelerometer" in window;

    prepareInterval = setInterval(() => {
      beforeStartCounter -= 1;
      if (beforeStartCounter === 0) {
        if (prepareInterval != null) clearInterval(prepareInterval);
        prepareInterval = null;
        startVirusScan();
      }
    }, 1000);

    if (hasAccelerometer) {
      try {
        accelerometer = new Accelerometer({ frequency: 10 });
        accelerometer.start();
        let old_coords = [null, null, null] as (number | null)[];

        sensorInterval = setInterval(() => {
          if (accelerometer == null) return;
          const x = Math.round(Math.abs(accelerometer.x ?? 0) * 100) / 100;
          const y = Math.round(Math.abs(accelerometer.y ?? 0) * 100) / 100;
          const z = Math.round(Math.abs(accelerometer.z ?? 0) * 100) / 100;

          if (old_coords[0] == null) {
            old_coords = [x, y, z];
            return;
          }

          x_diff = Math.round(Math.pow(x - old_coords[0]!, 2) * 100) / 100;
          y_diff = Math.round(Math.pow(y - old_coords[1]!, 2) * 100) / 100;
          z_diff = Math.round(Math.pow(z - old_coords[2]!, 2) * 100) / 100;
          overallMovement = Math.round((x_diff + y_diff + z_diff) * 100) / 100;
          if (overallMovement > 0.5 && moved !== true) moved = true;
          old_coords = [x, y, z];
        }, 500);
      } catch (error) {
        console.warn("Датчик движения недоступен", error);
        hasAccelerometer = false;
      }
    }

    return () => {
      if (prepareInterval != null) clearInterval(prepareInterval);
      if (scanInterval != null) clearInterval(scanInterval);
      if (penaltyInterval != null) clearInterval(penaltyInterval);
      if (sensorInterval != null) clearInterval(sensorInterval);
      accelerometer?.stop();
    };
  });
</script>

<div
  class="dontmove-page text-xl text-white flex flex-col items-center justify-center"
>
  {#if beforeStartCounter > 0}
    {$t("virus.starts", { seconds: beforeStartCounter })}<br />
    {$t("virus.dontMove")}
  {:else if hasAccelerometer || dev}
    <div>
      {#if moved}
        {$t("virus.moved", { seconds: scanFailedCounter })}
      {:else}
        {$t("virus.active", { seconds: virusScanCounter })}<br />
        {$t("virus.still")}
      {/if}
    </div>
  {:else}
    {$t("virus.active", { seconds: virusScanCounter })}<br />
    {$t("virus.still")}
  {/if}
</div>

<style>
  .dontmove-page {
    width: 100%;
    min-height: var(--app-height);
    padding:
      max(20px, var(--safe-top))
      max(var(--page-gutter), var(--safe-right))
      max(20px, var(--safe-bottom))
      max(var(--page-gutter), var(--safe-left));
    text-align: center;
  }
</style>
