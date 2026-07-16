<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { onDestroy, onMount } from "svelte";
  import { language } from "$lib/i18n";

  const REQUIRED_STABILITY = 8;
  const MAX_TIME = 80;
  const PHASES = [
    [18, 24, 16, 20],
    [24, 16, 22, 18],
    [20, 25, 18, 22],
  ];
  const names = [
    ["Серверы", "Servers"],
    ["Связь", "Comms"],
    ["Защита", "Defense"],
    ["Архив", "Archive"],
  ];
  let phase = 0;
  let demands = [...PHASES[0]];
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
  $: total = allocation.reduce((sum, value) => sum + Number(value), 0);
  $: sectorsOk = allocation.map(
    (value, index) =>
      Number(value) >= demands[index] && Number(value) <= demands[index] + 8
  );
  $: stable = total <= 100 && sectorsOk.every(Boolean);

  onMount(start);
  onDestroy(cleanup);

  function start() {
    cleanup();
    phase = 0;
    demands = [...PHASES[0]];
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
    if (phase >= PHASES.length - 1) {
      win();
      return;
    }

    phase += 1;
    demands = [...PHASES[phase]];
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

<main class="grid-page"><section class="console">
  <p class="eyebrow">{bi("Управление инфраструктурой", "Infrastructure control")}</p><h1>{bi("Стабилизация энергосети", "Power grid stabilization")}</h1>
  <div class="phase-pill">{bi("Этап", "Stage")} <strong>{phase + 1}/{PHASES.length}</strong></div>
  <p class="description">{bi("Распределите не больше 100 единиц мощности. Каждый сектор должен получить свой запрос, но не более чем на 8 единиц сверх него. Удержите баланс на трёх этапах.", "Distribute no more than 100 power units. Each sector must meet its demand without exceeding it by more than 8. Hold the balance across three stages.")}</p>
  <div class="summary"><div><small>{bi("Нагрузка", "Load")}</small><strong class:over={total>100}>{total}/100</strong></div><div><small>{bi("Стабильность", "Stability")}</small><strong>{stability.toFixed(1)}/{REQUIRED_STABILITY}s</strong></div><div><small>{bi("Осталось", "Remaining")}</small><strong>{timeLeft}s</strong></div></div>
  <div class="stability"><b style={`width:${stability/REQUIRED_STABILITY*100}%`}></b></div>
  <div class="sectors">{#each names as name,index}<article class:ok={sectorsOk[index]} class:bad={!sectorsOk[index]}>
    <div class="sector-head"><div><span class="led"></span><strong>{name[$language === "en" ? 1 : 0]}</strong></div><span>{bi("запрос", "demand")} <b>{demands[index]}</b></span></div>
    <input aria-label={`Power for ${name[1]}`} type="range" min="0" max="40" step="1" bind:value={allocation[index]}/>
    <div class="sector-foot"><span>0</span><strong>{allocation[index]} {bi("ед.", "units")}</strong><span>40</span></div>
  </article>{/each}</div>
  <p class:good={stable} class="state">{total>100 ? bi("ПЕРЕГРУЗКА СЕТИ", "GRID OVERLOAD") : stable ? bi("СЕТЬ СТАБИЛЬНА — УДЕРЖИВАЙТЕ", "GRID STABLE — HOLD") : bi("ТРЕБУЕТСЯ БАЛАНСИРОВКА", "BALANCING REQUIRED")}</p>
  {#if failed}<div class="overlay"><strong>{bi("Энергосеть отключена", "Power grid offline")}</strong><button on:click={start}>{bi("Перезапустить сеть", "Restart grid")}</button></div>{/if}
</section></main>

<style>
  :global(html),:global(body){overflow:hidden;background:#030306}.grid-page{width:100vw;min-height:100vh;padding:14px;display:grid;place-items:center;background:radial-gradient(circle at top,rgba(139,92,246,.18),transparent 30rem),#030306;color:#fff}.console{position:relative;width:min(620px,100%);padding:22px;border:1px solid rgba(167,139,250,.25);border-radius:24px;background:rgba(8,6,13,.97)}.eyebrow,small{color:#c4b5fd;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1{margin:6px 0 8px;font-size:clamp(27px,7vw,41px);font-weight:950;line-height:1}.phase-pill{width:max-content;margin:0 0 8px;padding:6px 9px;border:1px solid rgba(167,139,250,.26);border-radius:9px;background:rgba(76,29,149,.25);color:rgba(255,255,255,.6);font-size:10px;font-weight:900}.phase-pill strong{color:#c4b5fd}.description{color:rgba(255,255,255,.6);font-size:13px;line-height:1.4}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:15px 0 7px}.summary div{min-width:0;display:grid;gap:3px;padding:10px;border-radius:11px;background:rgba(255,255,255,.04)}.summary strong{font-size:18px}.summary strong.over{color:#f87171}.stability{height:9px;border-radius:8px;background:#161122;overflow:hidden}.stability b{display:block;height:100%;background:linear-gradient(90deg,#8b5cf6,#4ade80);transition:width .1s}.sectors{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.sectors article{min-width:0;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.035)}.sectors article.ok{border-color:rgba(74,222,128,.5)}.sectors article.bad{border-color:rgba(248,113,113,.22)}.sector-head,.sector-foot{min-width:0;display:flex;justify-content:space-between;align-items:center}.sector-head>div{min-width:0;display:flex;gap:7px;align-items:center}.sector-head strong{min-width:0;overflow-wrap:anywhere}.sector-head>span{flex:0 0 auto}.sector-head span{color:rgba(255,255,255,.5);font-size:10px}.sector-head b{color:#c4b5fd}.led{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:#ef4444}.ok .led{background:#4ade80;box-shadow:0 0 8px #22c55e}.sectors input{display:block;min-width:0;width:100%;margin:10px 0 4px;accent-color:#8b5cf6}.sector-foot{color:rgba(255,255,255,.3);font-size:10px}.sector-foot strong{color:#fff;font-size:13px}.state{text-align:center;color:#fca5a5;font-size:12px;font-weight:950;letter-spacing:.06em}.state.good{color:#86efac}.overlay{position:absolute;inset:0;z-index:3;display:grid;place-content:center;gap:12px;text-align:center;border-radius:24px;background:rgba(0,0,0,.9)}.overlay strong{font-size:24px}.overlay button{padding:14px;border:1px solid #a78bfa;border-radius:12px;background:#4c1d95;color:#fff;font-weight:900}@media(max-height:720px){.description{display:none}.console{padding:14px}.summary{margin:8px 0 5px}.sectors{margin-top:7px}.sectors article{padding:8px}.sectors input{margin:5px 0}}
  .grid-page{width:100%;height:100%;min-height:0;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:10px max(12px,var(--safe-right)) max(12px,var(--safe-bottom)) max(12px,var(--safe-left))}.grid-page .console{flex:0 0 auto;min-width:0;margin:auto 0}
  @media(max-width:360px){.console{padding:12px}.summary{gap:4px}.summary div{padding:7px 4px}.summary small{font-size:8px}.summary strong{font-size:14px}.sector-head{align-items:flex-start;flex-direction:column;gap:3px}.sector-head>span{padding-left:15px}.sectors article{padding:8px}.sector-foot strong{font-size:11px}}
</style>
