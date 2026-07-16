<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";
  import {
    WIRETAP_HOLD_SECONDS,
    WIRETAP_ROUNDS,
    driftWiretapTarget,
    getWiretapStation,
    isWiretapJammed,
    isWiretapLocked,
    isWiretapTargetVisible,
    shouldDriftWiretapTarget,
    wiretapSignalQuality,
  } from "$lib/minigames/wiretapLogic.js";
  import { onDestroy, onMount } from "svelte";

  let round = 1;
  let controls: [number, number] = [50, 50];
  let target: [number, number] = [30, 70];
  let holdProgress = 0;
  let tickCount = 10;
  let active = false;
  let finished = false;
  let transition = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let transitionTimer: ReturnType<typeof setTimeout> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  let bi = (ru: string, _en: string) => ru;

  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  $: stationTag = typeof localStorage === "undefined"
    ? "wiretap1"
    : localStorage.getItem("currentTaskTag") || "wiretap1";
  $: station = getWiretapStation(stationTag);
  $: jammed = isWiretapJammed(station, tickCount);
  $: targetVisible = !jammed && isWiretapTargetVisible(station, tickCount);
  $: locked = isWiretapLocked(controls, target, station, jammed);
  $: signal = wiretapSignalQuality(controls, target);
  $: displayedSignal = jammed
    ? Math.max(0, Math.min(100, signal + ((tickCount % 9) - 4) * 13))
    : signal;

  onMount(startGame);
  onDestroy(cleanup);

  function startGame() {
    cleanup();
    round = 1;
    controls = [50, 50];
    holdProgress = 0;
    tickCount = 10;
    active = true;
    finished = false;
    transition = false;
    createTarget();
    interval = setInterval(tick, 100);
  }

  function createTarget() {
    target = [
      16 + Math.floor(Math.random() * 69),
      16 + Math.floor(Math.random() * 69),
    ];
    controls = [50, 50];
    holdProgress = 0;
    tickCount = 10;
  }

  function tick() {
    if (!active || transition) return;
    tickCount += 1;

    if (shouldDriftWiretapTarget(station, tickCount)) {
      target = driftWiretapTarget(target, station);
    }

    if (locked) {
      holdProgress = Math.min(
        WIRETAP_HOLD_SECONDS,
        holdProgress + 0.1
      );
      if (holdProgress >= WIRETAP_HOLD_SECONDS) completeRound();
    } else {
      holdProgress = Math.max(0, holdProgress - (jammed ? 0.08 : 0.16));
    }
  }

  function completeRound() {
    if (round >= WIRETAP_ROUNDS) {
      active = false;
      finished = true;
      cleanup();
      finishTimer = setTimeout(() => gotoReplace("/minigamedone"), 850);
      return;
    }

    transition = true;
    transitionTimer = setTimeout(() => {
      transitionTimer = null;
      round += 1;
      createTarget();
      transition = false;
    }, 850);
  }

  function nudge(index: number, amount: number) {
    controls[index] = Math.max(0, Math.min(100, Number(controls[index]) + amount));
    controls = [controls[0], controls[1]];
  }

  function cleanup() {
    if (interval != null) clearInterval(interval);
    if (transitionTimer != null) clearTimeout(transitionTimer);
    if (finishTimer != null) clearTimeout(finishTimer);
    interval = null;
    transitionTimer = null;
    finishTimer = null;
  }
</script>

<main class="wiretap-page">
  <section class="terminal">
    <header>
      <div>
        <p class="eyebrow">{bi("Пеленгатор", "Signal locator")}</p>
        <h1>{bi("Перехват сигнала", "Signal interception")}</h1>
      </div>
      <div class="station-badge">
        <span>{bi("ТОЧКА", "STATION")}</span>
        <strong>{station}/3</strong>
      </div>
    </header>

    <div class="mission-row">
      <span>{bi("Пакет", "Burst")} <strong>{round}/{WIRETAP_ROUNDS}</strong></span>
      <span>{station === 1
        ? bi("стабильная цель", "steady target")
        : station === 2
          ? bi("дрейфующая цель", "drifting target")
          : bi("дрейф + глушение", "drift + jamming")}</span>
    </div>

    <div class="radar" class:jammed>
      <div class="radar-grid"></div>
      {#if targetVisible}
        <div
          class="target"
          style={`left:${target[0]}%;top:${100 - target[1]}%`}
          aria-hidden="true"
        ><i></i></div>
      {/if}
      <div
        class="crosshair"
        class:locked
        style={`left:${controls[0]}%;top:${100 - controls[1]}%`}
        aria-hidden="true"
      ><i></i></div>
      <span class="axis-x">{bi("ЧАСТОТА", "FREQUENCY")}</span>
      <span class="axis-y">{bi("ФАЗА", "PHASE")}</span>
      {#if jammed}
        <div class="jam-label">{bi("СИГНАЛ ЗАГЛУШЕН", "SIGNAL JAMMED")}</div>
      {/if}
    </div>

    <div class="signal-panel">
      <div class="signal-heading">
        <span>{bi("Сила сигнала", "Signal strength")}</span>
        <strong>{displayedSignal}%</strong>
      </div>
      <div class="waveform" class:jammed>
        {#each Array(24) as _, index}
          <i style={`height:${Math.max(8, Math.min(100, displayedSignal * (0.38 + ((index * 17 + tickCount) % 10) / 16)))}%`}></i>
        {/each}
      </div>
    </div>

    <div class="controls">
      {#each controls as value, index}
        <div class="control">
          <div class="control-heading">
            <strong>{index === 0
              ? bi("Частота", "Frequency")
              : bi("Сдвиг фазы", "Phase shift")}</strong>
            <span>{Math.round(value)}</span>
          </div>
          <input
            aria-label={index === 0 ? "Frequency" : "Phase"}
            type="range"
            min="0"
            max="100"
            step="1"
            bind:value={controls[index]}
          />
          <div class="fine-controls">
            <button type="button" on:click={() => nudge(index, -2)}>−2</button>
            <span>{index === 0 ? "MHz" : "°"}</span>
            <button type="button" on:click={() => nudge(index, 2)}>+2</button>
          </div>
        </div>
      {/each}
    </div>

    <div class="lock-box" class:locked class:jammed>
      <div>
        <span>{jammed
          ? bi("Дождитесь окончания помех", "Wait for the jamming to end")
          : locked
            ? bi("Удерживайте перекрестие на цели", "Keep the crosshair on target")
            : bi("Совместите перекрестие с импульсом", "Align the crosshair with the pulse")}</span>
        <strong>{holdProgress.toFixed(1)} / {WIRETAP_HOLD_SECONDS.toFixed(1)}s</strong>
      </div>
      <progress value={holdProgress} max={WIRETAP_HOLD_SECONDS}></progress>
    </div>

    {#if transition}
      <div class="round-overlay">{bi("Пакет перехвачен — поиск следующего…", "Burst captured — locating next…")}</div>
    {/if}
    {#if finished}
      <div class="round-overlay success">{bi("Точка перехвата завершена", "Interception station complete")}</div>
    {/if}
  </section>
</main>

<style>
  :global(html),:global(body){overflow:hidden;background:#020305}.wiretap-page{width:100%;height:100%;min-height:0;padding:10px max(12px,var(--safe-right)) max(12px,var(--safe-bottom)) max(12px,var(--safe-left));display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;background:radial-gradient(circle at 50% 0,rgba(14,165,233,.18),transparent 30rem),#020305;color:#fff}.terminal{position:relative;flex:0 0 auto;min-width:0;width:min(620px,100%);margin:auto 0;padding:clamp(14px,4vw,22px);border:1px solid rgba(56,189,248,.25);border-radius:24px;background:rgba(5,8,12,.97);box-shadow:0 22px 80px #000}.terminal>header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.eyebrow{margin:0;color:#7dd3fc;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}h1{margin:5px 0 0;font-size:clamp(26px,7vw,40px);font-weight:950;line-height:1}.station-badge{flex:0 0 auto;min-width:58px;padding:7px 10px;display:grid;text-align:center;border:1px solid rgba(56,189,248,.3);border-radius:11px;background:rgba(7,89,133,.28)}.station-badge span{font-size:7px;color:rgba(255,255,255,.45);font-weight:900}.station-badge strong{color:#7dd3fc;font-size:18px}.mission-row{margin:12px 0 8px;padding:7px 9px;display:flex;justify-content:space-between;gap:10px;border-radius:9px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.48);font-size:10px;font-weight:800}.mission-row strong{color:#7dd3fc}.radar{position:relative;width:100%;height:clamp(150px,27vh,220px);overflow:hidden;border:1px solid rgba(56,189,248,.28);border-radius:15px;background:radial-gradient(circle at center,rgba(14,165,233,.12),transparent 55%),#03090d;touch-action:none}.radar.jammed{animation:jam .14s steps(2,end) infinite}.radar-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(56,189,248,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.09) 1px,transparent 1px);background-size:12.5% 12.5%}.radar-grid::after{content:"";position:absolute;inset:50% 0 auto;border-top:1px solid rgba(125,211,252,.22)}.target,.crosshair{position:absolute;width:28px;height:28px;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}.target{border:2px solid #facc15;box-shadow:0 0 20px #facc15;animation:pulse .45s alternate infinite}.target i{position:absolute;inset:7px;border-radius:50%;background:#fde047}.crosshair{border:1px solid rgba(255,255,255,.78)}.crosshair::before,.crosshair::after{content:"";position:absolute;background:#fff;box-shadow:0 0 5px #fff}.crosshair::before{top:13px;left:-10px;width:46px;height:1px}.crosshair::after{top:-10px;left:13px;width:1px;height:46px}.crosshair i{position:absolute;inset:10px;border:1px solid #fff;border-radius:50%}.crosshair.locked{border-color:#4ade80;box-shadow:0 0 18px #22c55e}.crosshair.locked::before,.crosshair.locked::after{background:#4ade80}.axis-x,.axis-y{position:absolute;color:rgba(125,211,252,.34);font-size:7px;font-weight:900;letter-spacing:.12em}.axis-x{right:8px;bottom:5px}.axis-y{top:8px;left:5px;transform:rotate(-90deg) translateX(-100%);transform-origin:left top}.jam-label{position:absolute;inset:0;display:grid;place-items:center;background:rgba(127,29,29,.18);color:#fca5a5;font-size:13px;font-weight:950;letter-spacing:.09em}.signal-panel{margin-top:8px}.signal-heading{display:flex;justify-content:space-between;color:rgba(255,255,255,.5);font-size:10px;font-weight:900}.signal-heading strong{color:#7dd3fc}.waveform{height:28px;margin-top:4px;padding:4px 6px;display:flex;gap:3px;align-items:center;border-radius:8px;background:#061017}.waveform i{flex:1;max-height:100%;background:#38bdf8;box-shadow:0 0 5px rgba(56,189,248,.7);transition:height .1s}.waveform.jammed i{background:#ef4444}.controls{margin-top:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.control{min-width:0;padding:9px;border-radius:11px;background:rgba(255,255,255,.04)}.control-heading{display:flex;justify-content:space-between;gap:8px;font-size:10px}.control-heading strong{color:#7dd3fc}.control-heading span{font-weight:900}.control input{display:block;width:100%;margin:7px 0;accent-color:#38bdf8;touch-action:pan-x}.fine-controls{display:grid;grid-template-columns:45px 1fr 45px;gap:5px;align-items:center}.fine-controls button{min-height:30px;border:1px solid rgba(125,211,252,.26);border-radius:8px;background:#0c2635;color:#fff;font-weight:900}.fine-controls span{text-align:center;color:rgba(255,255,255,.35);font-size:9px;font-weight:900}.lock-box{margin-top:8px;padding:9px 11px;border:1px solid rgba(255,255,255,.1);border-radius:11px}.lock-box.locked{border-color:#4ade80;background:rgba(34,197,94,.08)}.lock-box.jammed{border-color:#ef4444;background:rgba(127,29,29,.12)}.lock-box>div{display:flex;justify-content:space-between;gap:8px;color:rgba(255,255,255,.55);font-size:10px;font-weight:800}.lock-box strong{flex:0 0 auto;color:#fff}.lock-box progress{display:block;width:100%;height:9px;margin-top:6px;accent-color:#22c55e}.round-overlay{position:absolute;inset:0;z-index:4;padding:20px;display:grid;place-items:center;border-radius:24px;background:rgba(0,0,0,.88);color:#7dd3fc;text-align:center;font-size:18px;font-weight:950}.round-overlay.success{color:#86efac}@keyframes pulse{to{transform:translate(-50%,-50%) scale(1.22);opacity:.65}}@keyframes jam{50%{filter:hue-rotate(120deg);transform:translateX(2px)}}@media(max-width:380px){.terminal{padding:12px}.controls{grid-template-columns:1fr}.radar{height:145px}.lock-box>div{align-items:flex-start;flex-direction:column;gap:3px}}@media(max-height:620px) and (orientation:landscape){.terminal{margin:0}.mission-row{margin:6px 0}.radar{height:125px}.controls{grid-template-columns:repeat(2,minmax(0,1fr))}.control{padding:6px}.control input{margin:3px 0}.waveform{height:21px}.lock-box{margin-top:5px}}
</style>
