<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { onDestroy, onMount } from "svelte";
  import { language } from "$lib/i18n";
  import {
    POWER_GRID_MAX_CIRCUIT_DELTA,
    POWER_GRID_MAX_EXCESS,
    POWER_GRID_PHASES,
    getPowerGridState,
  } from "$lib/minigames/powerGridLogic.js";

  const REQUIRED_STABILITY = 8;
  const MAX_TIME = 100;
  const names = [
    ["Серверы", "Servers"],
    ["Связь", "Comms"],
    ["Защита", "Defense"],
    ["Архив", "Archive"],
  ];
  let phase = 0;
  let demands = [...POWER_GRID_PHASES[0].demands];
  let allocation = [30, 12, 29, 10];
  let stability = 0;
  let timeLeft = MAX_TIME;
  let deadline = 0;
  let lastTick = 0;
  let active = true;
  let failed = false;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  $: phaseProfile = POWER_GRID_PHASES[phase];
  $: gridState = getPowerGridState(allocation, phaseProfile);
  $: total = gridState.total;
  $: sectorsOk = gridState.sectorsOk;
  $: circuitA = gridState.circuitA;
  $: circuitB = gridState.circuitB;
  $: circuitDelta = gridState.circuitDelta;
  $: loadOk = gridState.loadOk;
  $: circuitsOk = gridState.circuitsOk;
  $: stable = gridState.stable;

  onMount(start);
  onDestroy(cleanup);

  function start() {
    cleanup();
    phase = 0;
    demands = [...POWER_GRID_PHASES[0].demands];
    allocation = [30, 12, 29, 10];
    stability = 0;
    timeLeft = MAX_TIME;
    lastTick = Date.now();
    deadline = lastTick + MAX_TIME * 1000;
    active = true;
    failed = false;
    tickTimer = setInterval(tick, 100);
  }

  function tick() {
    if (!active) return;
    const currentTime = Date.now();
    const elapsedSeconds = Math.min(0.5, (currentTime - lastTick) / 1000);
    lastTick = currentTime;
    timeLeft = Math.max(0, Math.ceil((deadline - currentTime) / 1000));

    if (timeLeft <= 0) {
      fail();
      return;
    }

    if (stable) {
      stability = Math.min(REQUIRED_STABILITY, stability + elapsedSeconds);
    } else {
      stability = Math.max(0, stability - elapsedSeconds * 1.6);
    }
    if (stability >= REQUIRED_STABILITY) completePhase();
  }

  function completePhase() {
    if (phase >= POWER_GRID_PHASES.length - 1) {
      win();
      return;
    }

    phase += 1;
    demands = [...POWER_GRID_PHASES[phase].demands];
    stability = 0;
  }

  function win() {
    active = false;
    cleanup();
    finishTimer = setTimeout(() => gotoReplace("/minigamedone"), 800);
  }

  function fail() {
    active = false;
    failed = true;
    cleanup();
  }

  function cleanup() {
    if (tickTimer) clearInterval(tickTimer);
    if (finishTimer) clearTimeout(finishTimer);
    tickTimer = null;
    finishTimer = null;
  }
</script>

<main class="grid-page">
  <section class="console">
    <p class="eyebrow">{bi("Управление инфраструктурой", "Infrastructure control")}</p>
    <h1>{bi("Стабилизация энергосети", "Power grid stabilization")}</h1>
    <div class="phase-pill">{bi("Этап", "Stage")} <strong>{phase + 1}/{POWER_GRID_PHASES.length}</strong></div>
    <p class="description">{bi(
      `Попадите в диапазон ${phaseProfile.target[0]}–${phaseProfile.target[1]} единиц, закройте запрос каждого сектора без избытка выше ${POWER_GRID_MAX_EXCESS} и удерживайте разницу контуров не больше ${POWER_GRID_MAX_CIRCUIT_DELTA}.`,
      `Hit ${phaseProfile.target[0]}–${phaseProfile.target[1]} total units, meet every sector without more than ${POWER_GRID_MAX_EXCESS} excess, and keep the circuit difference at ${POWER_GRID_MAX_CIRCUIT_DELTA} or less.`
    )}</p>

    <div class="summary">
      <div><small>{bi("Нагрузка", "Load")}</small><strong class:bad-value={!loadOk}>{total}</strong><span>{phaseProfile.target[0]}–{phaseProfile.target[1]}</span></div>
      <div><small>{bi("Контуры", "Circuits")}</small><strong class:bad-value={!circuitsOk}>Δ {circuitDelta}</strong><span>≤ {POWER_GRID_MAX_CIRCUIT_DELTA}</span></div>
      <div><small>{bi("Стабильность", "Stability")}</small><strong>{stability.toFixed(1)}s</strong><span>/ {REQUIRED_STABILITY}s</span></div>
      <div><small>{bi("Осталось", "Remaining")}</small><strong>{timeLeft}s</strong><span>{bi("таймер", "timer")}</span></div>
    </div>
    <div class="stability"><b style={`width:${stability/REQUIRED_STABILITY*100}%`}></b></div>

    <div class="circuit-meter" class:ok={circuitsOk}>
      <span>A <strong>{circuitA}</strong></span>
      <div><i style={`left:${Math.max(4, Math.min(96, 50 + (circuitA - circuitB) * 4))}%`}></i></div>
      <span>B <strong>{circuitB}</strong></span>
    </div>

    <div class="sectors">
      {#each names as name,index}
        <article class:ok={sectorsOk[index]} class:bad={!sectorsOk[index]}>
          <div class="sector-head">
            <div><span class="led"></span><strong>{name[$language === "en" ? 1 : 0]}</strong></div>
            <span>{bi("запрос", "demand")} <b>{demands[index]}–{demands[index] + POWER_GRID_MAX_EXCESS}</b></span>
          </div>
          <input aria-label={`Power for ${name[1]}`} type="range" min="0" max="40" step="1" bind:value={allocation[index]}/>
          <div class="sector-foot"><span>0</span><strong>{allocation[index]} {bi("ед.", "units")}</strong><span>40</span></div>
        </article>
      {/each}
    </div>

    <p class:good={stable} class="state">{total > 100
      ? bi("ПЕРЕГРУЗКА СЕТИ", "GRID OVERLOAD")
      : !loadOk
        ? bi(`ПОПАДИТЕ В ДИАПАЗОН ${phaseProfile.target[0]}–${phaseProfile.target[1]}`, `HIT LOAD RANGE ${phaseProfile.target[0]}–${phaseProfile.target[1]}`)
        : !sectorsOk.every(Boolean)
          ? bi("ЗАКРОЙТЕ ЗАПРОСЫ СЕКТОРОВ", "MEET EVERY SECTOR DEMAND")
          : !circuitsOk
            ? bi("ВЫРОВНЯЙТЕ КОНТУРЫ A И B", "BALANCE CIRCUITS A AND B")
            : bi("СЕТЬ СТАБИЛЬНА — УДЕРЖИВАЙТЕ", "GRID STABLE — HOLD")}</p>
    {#if failed}
      <div class="overlay"><strong>{bi("Энергосеть отключена", "Power grid offline")}</strong><button on:click={start}>{bi("Перезапустить сеть", "Restart grid")}</button></div>
    {/if}
  </section>
</main>

<style>
  :global(html),:global(body){overflow:hidden;background:#030306}.grid-page{width:100vw;min-height:100vh;padding:14px;display:grid;place-items:center;background:radial-gradient(circle at top,rgba(139,92,246,.18),transparent 30rem),#030306;color:#fff}.console{position:relative;width:min(620px,100%);padding:22px;border:1px solid rgba(167,139,250,.25);border-radius:24px;background:rgba(8,6,13,.97)}.eyebrow,small{color:#c4b5fd;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1{margin:6px 0 8px;font-size:clamp(25px,6.5vw,41px);font-weight:950;line-height:1.04;text-wrap:balance}.phase-pill{width:max-content;margin:0 0 8px;padding:6px 9px;border:1px solid rgba(167,139,250,.26);border-radius:9px;background:rgba(76,29,149,.25);color:rgba(255,255,255,.6);font-size:10px;font-weight:900}.phase-pill strong{color:#c4b5fd}.description{color:rgba(255,255,255,.6);font-size:13px;line-height:1.4}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:15px 0 7px}.summary div{min-width:0;display:grid;gap:2px;padding:9px;border-radius:11px;background:rgba(255,255,255,.04)}.summary strong{font-size:16px}.summary strong.bad-value{color:#f87171}.summary div>span{color:rgba(255,255,255,.36);font-size:9px;font-weight:800}.stability{height:9px;border-radius:8px;background:#161122;overflow:hidden}.stability b{display:block;height:100%;background:linear-gradient(90deg,#8b5cf6,#4ade80);transition:width .1s}.circuit-meter{margin-top:8px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;color:#fca5a5;font-size:10px;font-weight:900}.circuit-meter.ok{color:#86efac}.circuit-meter>div{position:relative;height:6px;border-radius:8px;background:linear-gradient(90deg,#7f1d1d,#4ade80 44%,#4ade80 56%,#7f1d1d)}.circuit-meter i{position:absolute;top:50%;width:12px;height:12px;transform:translate(-50%,-50%);border:2px solid white;border-radius:50%;background:#8b5cf6;transition:left .15s}.sectors{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.sectors article{min-width:0;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.035)}.sectors article.ok{border-color:rgba(74,222,128,.5)}.sectors article.bad{border-color:rgba(248,113,113,.22)}.sector-head,.sector-foot{min-width:0;display:flex;justify-content:space-between;align-items:center}.sector-head>div{min-width:0;display:flex;gap:7px;align-items:center}.sector-head strong{min-width:0;overflow-wrap:normal;word-break:normal}.sector-head>span{flex:0 0 auto}.sector-head span{color:rgba(255,255,255,.5);font-size:10px}.sector-head b{color:#c4b5fd}.led{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:#ef4444}.ok .led{background:#4ade80;box-shadow:0 0 8px #22c55e}.sectors input{display:block;min-width:0;width:100%;margin:10px 0 4px;accent-color:#8b5cf6}.sector-foot{color:rgba(255,255,255,.3);font-size:10px}.sector-foot strong{color:#fff;font-size:13px}.state{text-align:center;color:#fca5a5;font-size:11px;font-weight:950;letter-spacing:.04em}.state.good{color:#86efac}.overlay{position:absolute;inset:0;z-index:3;display:grid;place-content:center;gap:12px;text-align:center;border-radius:24px;background:rgba(0,0,0,.9)}.overlay strong{font-size:24px}.overlay button{padding:14px;border:1px solid #a78bfa;border-radius:12px;background:#4c1d95;color:#fff;font-weight:900}@media(max-height:720px){.description{display:none}.console{padding:14px}.summary{margin:8px 0 5px}.sectors{margin-top:6px}.sectors article{padding:8px}.sectors input{margin:5px 0}.circuit-meter{margin-top:5px}}
  .grid-page{width:100%;height:100%;min-height:0;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:10px max(12px,var(--safe-right)) max(12px,var(--safe-bottom)) max(12px,var(--safe-left))}.grid-page .console{flex:0 0 auto;min-width:0;margin:auto 0}
  @media(max-width:430px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.summary div{padding:7px}.summary small{font-size:8px}.summary strong{font-size:14px}.sector-head{align-items:flex-start;flex-direction:column;gap:3px}.sector-head>span{padding-left:15px}.sector-head strong{font-size:14px}}@media(max-width:360px){.console{padding:12px}.summary{gap:4px}.sectors article{padding:8px}.sector-foot strong{font-size:11px}}
</style>
