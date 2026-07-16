<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import {
    VIRUS_SCAN_FAILED_PUNISH_SECS,
    VIRUS_SCAN_PREPARE_SECS,
    VIRUS_SCAN_TIME,
  } from "$lib/consts";
  import { t } from "$lib/i18n";
  import { lobbyStore, playerStore } from "$lib/stores";
  import type { Lobby } from "$lib/types";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction } from "$lib/websocket";
  import { onMount } from "svelte";

  type VirusScanView = Lobby["virusScan"];
  type ScanPhase = "prepare" | "scan" | "result";
  type DetectorMode = "starting" | "generic" | "device-motion" | "hold";
  type MotionEventConstructor = typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
  };

  let mounted = false;
  let phase: ScanPhase = "prepare";
  let detectorMode: DetectorMode = "starting";
  let result: "active" | "failed" | "passed" = "active";
  let moved = false;
  let motionPermissionAvailable = false;
  let requestingPermission = false;
  let fallbackHolding = false;
  let holdGraceUntil = 0;
  let completionInFlight = false;
  let beforeStartCounter = VIRUS_SCAN_PREPARE_SECS;
  let virusScanCounter = VIRUS_SCAN_TIME;
  let penaltyCounter = VIRUS_SCAN_FAILED_PUNISH_SECS;
  let localPrepareUntil = 0;
  let localScanUntil = 0;
  let localDeadlineUntil = 0;
  let penaltyUntil = 0;
  let lastServerScan: VirusScanView | null = null;
  let accelerometer: Accelerometer | null = null;
  let previousMotion: [number, number, number] | null = null;
  let clockInterval: number | null = null;
  let sensorProbeTimeout: number | null = null;
  let deviceMotionHandler: ((event: DeviceMotionEvent) => void) | null = null;
  let pauseStartedLocallyAt = 0;
  let lastPauseActive = false;

  $: serverScan = $lobbyStore?.virusScan;
  $: if (serverScan != null && serverScan !== lastServerScan) {
    lastServerScan = serverScan;
    synchronizeServerClock(serverScan);
  }
  $: if (($lobbyStore?.pause.active ?? false) !== lastPauseActive) {
    const pauseActive = $lobbyStore?.pause.active ?? false;
    if (pauseActive) {
      pauseStartedLocallyAt = Date.now();
    } else if (lastPauseActive && result === "failed") {
      penaltyUntil += Math.max(0, Date.now() - pauseStartedLocallyAt);
    }
    lastPauseActive = pauseActive;
  }

  beforeNavigate(({ to, cancel }) => {
    if (
      result === "active" &&
      $lobbyStore?.status.state === "started" &&
      $lobbyStore.virusScan?.state === "active" &&
      to?.route.id !== "/dontmove"
    ) {
      cancel();
    }
  });

  function synchronizeServerClock(scan: VirusScanView) {
    if (scan.state === "active") {
      const now = Date.now();
      localPrepareUntil = now + scan.prepareRemainingMs;
      localScanUntil = now + scan.scanRemainingMs;
      localDeadlineUntil = now + scan.deadlineRemainingMs;
      updateClock();
      return;
    }

    if (!mounted || result !== "active") return;
    if ($lobbyStore?.status.state !== "started") return;

    if (($playerStore?.taskLockedUntil ?? 0) > Date.now()) {
      showPenalty();
    } else {
      result = "passed";
      gotoReplace("/game");
    }
  }

  function recordMotion(x: number | null, y: number | null, z: number | null) {
    if (x == null || y == null || z == null) return;
    const current: [number, number, number] = [x, y, z];
    if (previousMotion == null) {
      previousMotion = current;
      return;
    }

    const movement = Math.sqrt(
      (current[0] - previousMotion[0]) ** 2 +
        (current[1] - previousMotion[1]) ** 2 +
        (current[2] - previousMotion[2]) ** 2
    );
    previousMotion = current;

    if (phase === "scan" && !$lobbyStore?.pause.active && movement > 0.7) {
      markMoved();
    }
  }

  function markMoved() {
    if (result !== "active" || phase !== "scan" || moved) return;
    moved = true;
    void failVirusScan();
  }

  function useHoldFallback() {
    stopGenericSensor();
    removeDeviceMotionListener();
    detectorMode = "hold";
    previousMotion = null;
  }

  function setupDeviceMotion() {
    removeDeviceMotionListener();
    detectorMode = "starting";
    deviceMotionHandler = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      detectorMode = "device-motion";
      if (sensorProbeTimeout != null) window.clearTimeout(sensorProbeTimeout);
      sensorProbeTimeout = null;
      recordMotion(acceleration?.x ?? null, acceleration?.y ?? null, acceleration?.z ?? null);
    };
    window.addEventListener("devicemotion", deviceMotionHandler);
    previousMotion = null;
    sensorProbeTimeout = window.setTimeout(() => {
      if (detectorMode === "starting") useHoldFallback();
    }, 1_200);
  }

  async function enableMotionSensor() {
    const MotionEvent = window.DeviceMotionEvent as MotionEventConstructor | undefined;
    if (MotionEvent?.requestPermission == null || requestingPermission) return;

    requestingPermission = true;
    try {
      if ((await MotionEvent.requestPermission()) === "granted") {
        motionPermissionAvailable = false;
        setupDeviceMotion();
      } else {
        useHoldFallback();
      }
    } catch {
      useHoldFallback();
    } finally {
      requestingPermission = false;
    }
  }

  function setupMotionDetection() {
    const MotionEvent = window.DeviceMotionEvent as MotionEventConstructor | undefined;
    motionPermissionAvailable = typeof MotionEvent?.requestPermission === "function";

    if ("Accelerometer" in window) {
      try {
        accelerometer = new Accelerometer({ frequency: 12 });
        accelerometer.addEventListener("reading", () => {
          if (accelerometer == null) return;
          detectorMode = "generic";
          if (sensorProbeTimeout != null) window.clearTimeout(sensorProbeTimeout);
          sensorProbeTimeout = null;
          recordMotion(
            accelerometer.x ?? null,
            accelerometer.y ?? null,
            accelerometer.z ?? null
          );
        });
        accelerometer.addEventListener("error", () => {
          if (motionPermissionAvailable) useHoldFallback();
          else if (MotionEvent != null) setupDeviceMotion();
          else useHoldFallback();
        });
        accelerometer.start();
        sensorProbeTimeout = window.setTimeout(() => {
          if (detectorMode !== "starting") return;
          if (motionPermissionAvailable) useHoldFallback();
          else if (MotionEvent != null) setupDeviceMotion();
          else useHoldFallback();
        }, 1_200);
        return;
      } catch {
        stopGenericSensor();
      }
    }

    if (motionPermissionAvailable) useHoldFallback();
    else if (MotionEvent != null) setupDeviceMotion();
    else useHoldFallback();
  }

  function stopGenericSensor() {
    accelerometer?.stop();
    accelerometer = null;
    if (sensorProbeTimeout != null) window.clearTimeout(sensorProbeTimeout);
    sensorProbeTimeout = null;
  }

  function removeDeviceMotionListener() {
    if (deviceMotionHandler != null) {
      window.removeEventListener("devicemotion", deviceMotionHandler);
    }
    deviceMotionHandler = null;
  }

  function startHolding() {
    if (detectorMode !== "hold" || result !== "active") return;
    fallbackHolding = true;
  }

  function stopHolding() {
    if (detectorMode !== "hold") return;
    const wasHolding = fallbackHolding;
    fallbackHolding = false;
    if (wasHolding && phase === "scan" && result === "active") markMoved();
  }

  async function failVirusScan() {
    if (result !== "active") return;
    fallbackHolding = false;
    showPenalty();
    await emitGameAction({ action: "virusScanFailed" });
  }

  function showPenalty() {
    result = "failed";
    phase = "result";
    penaltyUntil = Date.now() + VIRUS_SCAN_FAILED_PUNISH_SECS * 1000;
    penaltyCounter = VIRUS_SCAN_FAILED_PUNISH_SECS;
  }

  async function completeVirusScan() {
    if (result !== "active" || completionInFlight) return;
    completionInFlight = true;
    const completion = await emitGameAction({ action: "virusScanCompleted" });
    completionInFlight = false;

    if (completion.success) {
      result = "passed";
      phase = "result";
      window.setTimeout(() => gotoReplace("/game"), 650);
    } else if (Date.now() < localDeadlineUntil) {
      window.setTimeout(() => void completeVirusScan(), 350);
    }
  }

  function updateClock() {
    if (!mounted || $lobbyStore?.pause.active) return;
    const now = Date.now();

    if (result === "failed") {
      penaltyCounter = Math.max(0, Math.ceil((penaltyUntil - now) / 1000));
      if (penaltyCounter === 0) gotoReplace("/game");
      return;
    }
    if (result !== "active") return;

    if (now < localPrepareUntil) {
      phase = "prepare";
      beforeStartCounter = Math.max(1, Math.ceil((localPrepareUntil - now) / 1000));
      return;
    }

    if (now < localScanUntil) {
      if (phase !== "scan") {
        phase = "scan";
        holdGraceUntil = now + 1_200;
        previousMotion = null;
      }
      virusScanCounter = Math.max(1, Math.ceil((localScanUntil - now) / 1000));
      if (detectorMode === "hold" && !fallbackHolding && now >= holdGraceUntil) {
        markMoved();
      }
      return;
    }

    if (detectorMode === "hold" && !fallbackHolding) {
      phase = "scan";
      markMoved();
      return;
    }
    phase = "result";
    void completeVirusScan();
  }

  onMount(() => {
    mounted = true;
    setupMotionDetection();
    if (serverScan != null) synchronizeServerClock(serverScan);
    clockInterval = window.setInterval(updateClock, 100);

    return () => {
      mounted = false;
      if (clockInterval != null) window.clearInterval(clockInterval);
      stopGenericSensor();
      removeDeviceMotionListener();
    };
  });
</script>

<div class="dontmove-page">
  <section class:moved={result === "failed"} class:passed={result === "passed"} class="scan-card">
    <span class="eyebrow">{$t("virus.badge")}</span>

    {#if result === "failed"}
      <h1>{$t("virus.failedTitle")}</h1>
      <div class="counter">{penaltyCounter}</div>
      <p>{$t("virus.moved", { seconds: penaltyCounter })}</p>
    {:else if result === "passed"}
      <h1>{$t("virus.passedTitle")}</h1>
      <div class="counter success">✓</div>
      <p>{$t("virus.passed")}</p>
    {:else if phase === "prepare"}
      <h1>{$t("virus.prepareTitle")}</h1>
      <div class="counter">{beforeStartCounter}</div>
      <p>{$t("virus.dontMove")}</p>
    {:else}
      <h1>{$t("virus.activeTitle")}</h1>
      <div class="counter">{virusScanCounter}</div>
      <p>{$t("virus.still")}</p>
    {/if}

    {#if result === "active" && motionPermissionAvailable && detectorMode === "hold"}
      <button class="permission-button" type="button" on:click={enableMotionSensor} disabled={requestingPermission}>
        {requestingPermission ? $t("virus.sensorWaiting") : $t("virus.sensorEnable")}
      </button>
    {/if}

    {#if result === "active" && detectorMode === "hold"}
      <button
        class:holding={fallbackHolding}
        class="hold-button"
        type="button"
        on:pointerdown={startHolding}
        on:pointerup={stopHolding}
        on:pointercancel={stopHolding}
        on:pointerleave={stopHolding}
      >
        {fallbackHolding ? $t("virus.holding") : $t("virus.hold")}
      </button>
      <small>{$t("virus.holdHint")}</small>
    {:else if result === "active"}
      <small>{$t("virus.sensorActive")}</small>
    {/if}
  </section>
</div>

<style>
  .dontmove-page {
    width: 100%;
    min-height: var(--app-height);
    display: grid;
    place-items: center;
    padding:
      max(72px, calc(var(--safe-top) + 58px))
      max(var(--page-gutter), var(--safe-right))
      max(24px, var(--safe-bottom))
      max(var(--page-gutter), var(--safe-left));
    text-align: center;
    background:
      radial-gradient(circle at 50% 20%, rgba(34, 197, 94, 0.16), transparent 42%),
      #020503;
  }

  .scan-card {
    width: min(100%, 480px);
    padding: clamp(24px, 7vw, 42px);
    border: 1px solid rgba(74, 222, 128, 0.38);
    border-radius: 24px;
    background: rgba(3, 12, 7, 0.94);
    box-shadow: 0 22px 70px rgba(0, 0, 0, 0.5), inset 0 0 34px rgba(34, 197, 94, 0.06);
  }

  .scan-card.moved {
    border-color: rgba(248, 113, 113, 0.55);
    box-shadow: inset 0 0 38px rgba(239, 68, 68, 0.12);
  }

  .scan-card.passed { border-color: rgba(56, 189, 248, 0.5); }
  .eyebrow { color: #86efac; font-size: 11px; font-weight: 900; letter-spacing: 0.16em; }
  h1 { margin: 12px 0 4px; font-size: clamp(24px, 7vw, 38px); font-weight: 950; }
  p { margin: 8px auto 0; color: rgba(255, 255, 255, 0.72); line-height: 1.5; }

  .counter {
    margin: 18px auto;
    color: #4ade80;
    font-size: clamp(64px, 22vw, 112px);
    font-weight: 950;
    line-height: 0.95;
    text-shadow: 0 0 28px rgba(74, 222, 128, 0.38);
  }

  .moved .counter { color: #f87171; text-shadow: 0 0 28px rgba(248, 113, 113, 0.35); }
  .counter.success { color: #38bdf8; }

  .permission-button,
  .hold-button {
    width: 100%;
    min-height: 54px;
    margin-top: 20px;
    border-radius: 15px;
    font-weight: 900;
  }

  .permission-button {
    border: 1px solid rgba(56, 189, 248, 0.52);
    background: rgba(7, 89, 133, 0.28);
    color: #bae6fd;
  }

  .hold-button {
    min-height: 82px;
    border: 1px solid rgba(74, 222, 128, 0.55);
    background: rgba(20, 83, 45, 0.32);
    color: #bbf7d0;
    touch-action: none;
    user-select: none;
  }

  .hold-button.holding {
    background: rgba(22, 163, 74, 0.38);
    box-shadow: 0 0 30px rgba(34, 197, 94, 0.18);
    transform: scale(0.985);
  }

  small { display: block; margin-top: 10px; color: rgba(255, 255, 255, 0.5); line-height: 1.4; }

  @media (orientation: landscape) and (max-height: 560px) {
    .dontmove-page { padding-top: max(54px, calc(var(--safe-top) + 46px)); }
    .scan-card { padding: 18px 28px; }
    .counter { margin: 8px auto; font-size: 54px; }
    h1 { margin-top: 6px; font-size: 24px; }
    .hold-button { min-height: 58px; margin-top: 10px; }
  }
</style>
