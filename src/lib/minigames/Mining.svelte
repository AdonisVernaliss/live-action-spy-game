<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { onDestroy } from "svelte";
  import { language } from "$lib/i18n";

  const REQUIRED_LOCKS = 9;
  const GAME_TIME = 50;

  let running = false;
  let finished = false;
  let locks = 0;
  let timeLeft = GAME_TIME;
  let cursor = 0;
  let direction = 1;
  let targetCenter = 50;
  let targetWidth = 22;
  let heat = 0;
  let message = "start";
  let messageModule = 0;
  let frame: number | null = null;
  let previous = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  let scaleElement: HTMLDivElement;
  let targetElement: HTMLDivElement;
  let cursorElement: HTMLDivElement;
  let lastPressAt = -1000;
  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  function messageText(
    messageKey: string,
    module: number,
    currentLanguage: "ru" | "en"
  ) {
    const pick = (ru: string, en: string) => currentLanguage === "en" ? en : ru;
    return ({
      start: pick("Нажмите «Запустить реактор»", "Press “Start reactor”"),
      lock: pick("Зафиксируйте индикатор в зелёной зоне", "Lock the indicator inside the green zone"),
      module: pick(`Модуль ${module} синхронизирован`, `Module ${module} synchronized`),
      exact: pick("Точный хеш — продолжайте", "Exact hash — continue"),
      error: pick("Ошибка синхронизации: реактор перегревается", "Synchronization error: reactor overheating"),
      failed: pick("Реактор сброшен. Запустите калибровку заново.", "Reactor reset. Start calibration again."),
      won: pick("Хеш-реактор стабилизирован", "Hash reactor stabilized"),
    }[messageKey] || messageKey);
  }

  $: targetLeft = Math.max(1, targetCenter - targetWidth / 2);
  $: targetRight = Math.min(99, targetCenter + targetWidth / 2);
  $: moduleNumber = Math.min(3, Math.floor(locks / 3) + 1);

  function startGame() {
    stopGame();
    running = true;
    finished = false;
    locks = 0;
    heat = 0;
    timeLeft = GAME_TIME;
    cursor = 0;
    direction = 1;
    previous = performance.now();
    message = "lock";
    chooseTarget();
    frame = requestAnimationFrame(animate);
    timer = setInterval(() => {
      timeLeft -= 1;
      heat = Math.max(0, heat - 2);
      if (timeLeft <= 0) failGame();
    }, 1000);
  }

  function animate(now: number) {
    if (!running) return;
    const delta = Math.min(40, now - previous);
    previous = now;
    const speed = 0.055 + locks * 0.004;
    cursor += direction * delta * speed;
    if (cursor >= 100) { cursor = 100; direction = -1; }
    if (cursor <= 0) { cursor = 0; direction = 1; }
    frame = requestAnimationFrame(animate);
  }

  function lockHash() {
    if (!running) return;
    if (cursorIsVisuallyInsideTarget()) {
      locks += 1;
      heat = Math.max(0, heat - 8);
      messageModule = locks / 3;
      message = locks % 3 === 0 ? "module" : "exact";
      if (locks >= REQUIRED_LOCKS) {
        winGame();
        return;
      }
      chooseTarget();
    } else {
      locks = Math.max(0, locks - 1);
      heat = Math.min(100, heat + 24);
      message = "error";
      if (heat >= 100) failGame();
      else chooseTarget();
    }
  }

  function cursorIsVisuallyInsideTarget() {
    if (scaleElement && targetElement && cursorElement) {
      const targetBounds = targetElement.getBoundingClientRect();
      const cursorBounds = cursorElement.getBoundingClientRect();
      const cursorCenter = (cursorBounds.left + cursorBounds.right) / 2;
      const tolerance = Math.max(3, scaleElement.clientWidth * 0.004);
      return (
        cursorCenter >= targetBounds.left - tolerance &&
        cursorCenter <= targetBounds.right + tolerance
      );
    }

    return cursor >= targetLeft && cursor <= targetRight;
  }

  function lockOnPress(event: Event) {
    event.preventDefault();
    const now = performance.now();
    if (now - lastPressAt < 250) return;
    lastPressAt = now;
    lockHash();
  }

  function lockOnClick() {
    if (performance.now() - lastPressAt < 350) return;
    lockHash();
  }

  function chooseTarget() {
    targetWidth = Math.max(9, 22 - locks * 1.35);
    targetCenter = 12 + Math.random() * 76;
  }

  function failGame() {
    stopGame();
    message = "failed";
  }

  function winGame() {
    running = false;
    finished = true;
    stopTimers();
    message = "won";
    finishTimer = setTimeout(() => gotoReplace("/minigamedone"), 700);
  }

  function stopTimers() {
    if (frame != null) cancelAnimationFrame(frame);
    if (timer != null) clearInterval(timer);
    if (finishTimer != null) clearTimeout(finishTimer);
    frame = null;
    timer = null;
    finishTimer = null;
  }

  function stopGame() {
    running = false;
    stopTimers();
  }

  onDestroy(stopGame);
</script>

<main class="mining-page">
  <section class="reactor-card">
    <p class="eyebrow">{bi("Майнинг · Хеш-реактор", "Mining · Hash reactor")}</p>
    <h1>{bi("Калибровка хеш-реактора", "Hash reactor calibration")}</h1>
    <p class="description">{bi("Фиксируйте бегущий индикатор только внутри зелёного диапазона. Каждые три точных хеша стабилизируют один модуль.", "Lock the moving indicator only inside the green range. Every three exact hashes stabilize one module.")}</p>

    <div class="status-grid">
      <div><small>{bi("Модуль", "Module")}</small><strong>{moduleNumber}/3</strong></div>
      <div><small>{bi("Хеши", "Hashes")}</small><strong>{locks}/{REQUIRED_LOCKS}</strong></div>
      <div><small>{bi("Время", "Time")}</small><strong>{timeLeft}s</strong></div>
    </div>

    <div class="reactor" class:danger={heat >= 70}>
      <div class="scale" bind:this={scaleElement}>
        <div bind:this={targetElement} class="target" style={`left:${targetLeft}%;width:${targetRight-targetLeft}%`}></div>
        <div bind:this={cursorElement} class="cursor" style={`left:${cursor}%`}></div>
      </div>
      <div class="ticks">{#each Array(21) as _}<i></i>{/each}</div>
    </div>

    <div class="heat-row"><span>{bi("Перегрев", "Heat")}</span><div><b style={`width:${heat}%`}></b></div><strong>{heat}%</strong></div>
    <p class="message">{messageText(message, messageModule, $language)}</p>

    {#if running}
      <button
        class="lock-button"
        on:pointerdown={lockOnPress}
        on:touchstart|nonpassive={lockOnPress}
        on:click={lockOnClick}
      >{bi("ЗАФИКСИРОВАТЬ ХЕШ", "LOCK HASH")}</button>
    {:else if !finished}
      <button class="start-button" on:click={startGame}>{bi("Запустить реактор", "Start reactor")}</button>
    {/if}
  </section>
</main>

<style>
  :global(html),:global(body){overflow:hidden;background:#020402}.mining-page{width:100vw;min-height:100vh;padding:18px;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,rgba(34,197,94,.18),transparent 30rem),#020402;color:#fff}.reactor-card{width:min(620px,100%);padding:24px;border:1px solid rgba(74,222,128,.24);border-radius:25px;background:rgba(5,10,6,.96);box-shadow:0 20px 80px #000}.eyebrow,small{color:#86efac;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1{margin:8px 0 10px;font-size:clamp(27px,7vw,42px);line-height:1;font-weight:950}.description{color:rgba(255,255,255,.62);font-size:14px;line-height:1.45}.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0}.status-grid div{display:grid;gap:4px;padding:12px;border-radius:13px;background:rgba(255,255,255,.045)}.status-grid strong{font-size:20px}.reactor{padding:25px 14px 12px;border:1px solid rgba(74,222,128,.22);border-radius:17px;background:#071009}.reactor.danger{animation:warning .35s alternate infinite}.scale{position:relative;height:58px;border-radius:10px;background:linear-gradient(180deg,#101b12,#050805);overflow:hidden}.target{position:absolute;top:0;height:100%;background:linear-gradient(90deg,rgba(34,197,94,.35),#4ade80,rgba(34,197,94,.35));box-shadow:0 0 25px #22c55e}.cursor{position:absolute;top:-6px;width:4px;height:70px;transform:translateX(-2px);background:white;box-shadow:0 0 13px white}.ticks{display:flex;justify-content:space-between;margin-top:7px}.ticks i{width:1px;height:7px;background:rgba(255,255,255,.25)}.heat-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin:16px 0;font-size:12px;font-weight:800}.heat-row>div{height:9px;border-radius:9px;background:#211;overflow:hidden}.heat-row b{display:block;height:100%;background:linear-gradient(90deg,#facc15,#ef4444)}.message{min-height:25px;text-align:center;color:rgba(255,255,255,.72);font-weight:800}.lock-button,.start-button{width:100%;padding:18px;border:1px solid #4ade80;border-radius:16px;background:#166534;color:#fff;font-size:17px;font-weight:950;touch-action:manipulation}.lock-button:active{transform:scale(.98);background:#22c55e}@keyframes warning{to{border-color:#ef4444;box-shadow:inset 0 0 30px rgba(239,68,68,.3)}}@media(max-height:650px){.description{display:none}.status-grid{margin:10px 0}.reactor-card{padding:17px}}
  .mining-page{width:100%;height:100%;min-height:0;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:10px max(12px,var(--safe-right)) max(12px,var(--safe-bottom)) max(12px,var(--safe-left))}.mining-page .reactor-card{flex:0 0 auto;min-width:0;margin:auto 0}
</style>
