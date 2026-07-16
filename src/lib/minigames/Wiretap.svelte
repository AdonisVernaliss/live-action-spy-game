<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { onDestroy } from "svelte";
  import { language } from "$lib/i18n";

  const TOTAL_CHANNELS = 4;
  const HOLD_REQUIRED = 2.5;
  let channel = 1;
  let values = [50, 50, 50];
  let targets = [25, 70, 40];
  let holdProgress = 0;
  let active = false;
  let finished = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  $: errors = values.map((value, index) => Math.abs(value - targets[index]));
  $: signal = Math.max(0, Math.round(100 - errors.reduce((sum, error) => sum + error, 0) * 0.9));
  $: locked = errors.every((error) => error <= Math.max(4, 9 - channel));

  function start() {
    channel = 1;
    finished = false;
    active = true;
    newChannel();
    if (interval != null) clearInterval(interval);
    interval = setInterval(tick, 100);
  }

  function tick() {
    if (!active) return;
    if (locked) {
      holdProgress = Math.min(HOLD_REQUIRED, holdProgress + 0.1);
      if (holdProgress >= HOLD_REQUIRED) completeChannel();
    } else {
      holdProgress = Math.max(0, holdProgress - 0.18);
    }
  }

  function completeChannel() {
    if (channel >= TOTAL_CHANNELS) {
      active = false;
      finished = true;
      cleanup();
      finishTimer = setTimeout(() => gotoReplace("/minigamedone"), 800);
      return;
    }
    channel += 1;
    newChannel();
  }

  function newChannel() {
    targets = targets.map(() => 12 + Math.floor(Math.random() * 77));
    values = values.map(() => 50);
    holdProgress = 0;
  }

  function nudge(index: number, amount: number) {
    values[index] = Math.max(0, Math.min(100, values[index] + amount));
    values = [...values];
  }

  function cleanup() {
    if (interval != null) clearInterval(interval);
    if (finishTimer != null) clearTimeout(finishTimer);
    interval = null;
    finishTimer = null;
  }
  onDestroy(cleanup);
</script>

<main class="wiretap-page">
  <section class="terminal">
    <p class="eyebrow">{bi("Перехват сигнала", "Signal interception")}</p>
    <h1>{bi("Перехват сигнала", "Signal interception")}</h1>
    <p class="description">{bi("Настройте три частотных канала. Чем ближе значения к скрытой частоте, тем сильнее сигнал. Удерживайте стабильную настройку 2,5 секунды.", "Tune three frequency bands. The closer each value is to the hidden frequency, the stronger the signal. Hold a stable lock for 2.5 seconds.")}</p>

    <div class="top-status"><span>{bi("Канал", "Channel")} <strong>{channel}/{TOTAL_CHANNELS}</strong></span><span>{bi("Сигнал", "Signal")} <strong>{signal}%</strong></span></div>
    <div class="signal-meter"><b style={`width:${signal}%`}></b></div>

    {#if !active && !finished}<button class="start" on:click={start}>{bi("Начать перехват", "Start interception")}</button>{/if}

    <div class="tuner-list">
      {#each values as value, index}
        <div class="tuner">
          <div class="tuner-heading"><strong>{($language === "en" ? ["LOW", "MID", "HIGH"] : ["НИЗКИЕ", "СРЕДНИЕ", "ВЫСОКИЕ"])[index]}</strong><span>{value}</span></div>
          <input aria-label={`Frequency ${index + 1}`} type="range" min="0" max="100" step="1" bind:value={values[index]} />
          <div class="fine-controls"><button on:click={() => nudge(index,-1)}>−1</button><span class:near={errors[index] <= 12}>{errors[index] <= 5 ? bi("ТОЧНО", "EXACT") : errors[index] <= 12 ? bi("БЛИЗКО", "CLOSE") : bi("ПОИСК", "SEARCH")}</span><button on:click={() => nudge(index,1)}>+1</button></div>
        </div>
      {/each}
    </div>

    <div class="lock-box" class:locked>
      <div><span>{locked ? bi("Сигнал стабилен — не двигайте регуляторы", "Signal stable — do not move the controls") : bi("Найдите диапазон сигнала", "Find the signal range")}</span><strong>{holdProgress.toFixed(1)} / {HOLD_REQUIRED.toFixed(1)}s</strong></div>
      <progress value={holdProgress} max={HOLD_REQUIRED}></progress>
    </div>

    {#if finished}<p class="success">{bi("Все каналы перехвачены", "All channels intercepted")}</p>{/if}
  </section>
</main>

<style>
  :global(html),:global(body){overflow:hidden;background:#020305}.wiretap-page{width:100vw;min-height:100vh;padding:16px;display:grid;place-items:center;background:radial-gradient(circle at top,rgba(14,165,233,.17),transparent 30rem),#020305;color:#fff}.terminal{width:min(620px,100%);padding:23px;border:1px solid rgba(56,189,248,.25);border-radius:25px;background:rgba(5,8,12,.96)}.eyebrow{color:#7dd3fc;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1{margin:7px 0 9px;font-size:clamp(29px,8vw,43px);font-weight:950;line-height:1}.description{color:rgba(255,255,255,.6);font-size:14px;line-height:1.4}.top-status{display:flex;justify-content:space-between;margin-top:18px}.top-status strong{color:#7dd3fc}.signal-meter{height:15px;margin:8px 0 14px;border-radius:10px;background:#09131a;overflow:hidden}.signal-meter b{display:block;height:100%;background:linear-gradient(90deg,#ef4444,#facc15 55%,#22c55e);transition:width .15s}.tuner-list{display:grid;gap:10px}.tuner{padding:12px;border-radius:14px;background:rgba(255,255,255,.045)}.tuner-heading{display:flex;justify-content:space-between}.tuner-heading strong{color:#7dd3fc;font-size:12px}.tuner input{width:100%;accent-color:#38bdf8;touch-action:pan-x}.fine-controls{display:grid;grid-template-columns:60px 1fr 60px;gap:8px;align-items:center;margin-top:5px}.fine-controls button{padding:7px;border:1px solid rgba(125,211,252,.35);border-radius:9px;background:#0c2635;color:#fff;font-weight:900}.fine-controls span{text-align:center;color:rgba(255,255,255,.4);font-size:11px;font-weight:900}.fine-controls span.near{color:#86efac}.lock-box{margin:14px 0;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:14px}.lock-box.locked{border-color:#4ade80;background:rgba(34,197,94,.08)}.lock-box div{display:flex;justify-content:space-between;gap:10px;font-size:12px}.lock-box progress{width:100%;margin-top:8px;accent-color:#22c55e}.start{width:100%;padding:16px;border:1px solid #38bdf8;border-radius:15px;background:#075985;color:#fff;font-size:16px;font-weight:950}.success{text-align:center;color:#86efac;font-size:18px;font-weight:900}@media(max-height:720px){.description{display:none}.terminal{padding:16px}.tuner{padding:8px}.tuner-list{gap:6px}.lock-box{margin:8px 0}}
  .wiretap-page{width:100%;height:100%;min-height:0;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:10px max(12px,var(--safe-right)) max(12px,var(--safe-bottom)) max(12px,var(--safe-left))}
  .wiretap-page .terminal{min-width:0;margin:auto 0}

  @media(max-width:390px){.wiretap-page{padding-right:8px;padding-left:8px}.terminal{padding:13px}.fine-controls{grid-template-columns:52px minmax(0,1fr) 52px}.lock-box div{align-items:flex-start;flex-direction:column;gap:4px}.start{position:sticky;bottom:0}}
  @media(max-height:560px) and (orientation:landscape){.wiretap-page .terminal{margin:0}.eyebrow{display:none}h1{margin-top:0;font-size:25px}.top-status{margin-top:7px}.signal-meter{margin-bottom:7px}.tuner-list{grid-template-columns:repeat(3,minmax(0,1fr))}.fine-controls{grid-template-columns:34px minmax(0,1fr) 34px;gap:3px}.fine-controls button{padding:5px 2px}.fine-controls span{font-size:8px}}
</style>
