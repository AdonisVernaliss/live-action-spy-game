<script lang="ts">
  import file from "$lib/minigames/images/file.png";
  import trash from "$lib/minigames/images/trash.png";
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";
  import { onDestroy, onMount } from "svelte";

  type Evidence = {
    id: number;
    signature: string;
    offsetX: number;
    offsetY: number;
  };

  const ROUND_COUNT = 7;
  const GAME_TIME = 55;
  const MAX_MISTAKES = 3;
  const REVEAL_TIME = 1700;
  const HEX = "0123456789ABCDEF";

  let evidence: Evidence[] = [];
  let targetSignature = "";
  let completed = 0;
  let mistakes = 0;
  let timeLeft = GAME_TIME;
  let now = Date.now();
  let revealUntil = 0;
  let deadline = 0;
  let nextEvidenceId = 1;
  let draggingId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let failed = false;
  let active = false;
  let feedback = "";
  let binElement: HTMLElement;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;

  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  $: revealing = now < revealUntil;

  onMount(startGame);
  onDestroy(cleanup);

  function startGame() {
    cleanup();
    completed = 0;
    mistakes = 0;
    timeLeft = GAME_TIME;
    now = Date.now();
    deadline = now + GAME_TIME * 1000;
    nextEvidenceId = 1;
    failed = false;
    active = true;
    feedback = bi("Запомните сигнатуру", "Memorize the signature");
    buildRound();
    tickTimer = setInterval(tick, 80);
  }

  function cleanup() {
    if (tickTimer) clearInterval(tickTimer);
    if (finishTimer) clearTimeout(finishTimer);
    tickTimer = null;
    finishTimer = null;
  }

  function tick() {
    if (!active) return;
    now = Date.now();
    timeLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
    if (timeLeft <= 0) failGame();
  }

  function randomSignature() {
    const pair = () =>
      `${HEX[Math.floor(Math.random() * HEX.length)]}${HEX[Math.floor(Math.random() * HEX.length)]}`;
    return `${pair()}-${pair()}-${pair()}`;
  }

  function mutateSignature(signature: string, mutation: number) {
    const characters = signature.split("");
    const mutableIndexes = [0, 1, 3, 4, 6, 7];
    const index = mutableIndexes[mutation % mutableIndexes.length];
    const current = characters[index];
    const shift = 1 + Math.floor(Math.random() * (HEX.length - 1));
    characters[index] = HEX[(HEX.indexOf(current) + shift) % HEX.length];

    if (mutation >= mutableIndexes.length) {
      const secondIndex = mutableIndexes[(mutation + 2) % mutableIndexes.length];
      const secondCurrent = characters[secondIndex];
      characters[secondIndex] = HEX[(HEX.indexOf(secondCurrent) + 1 + mutation) % HEX.length];
    }
    return characters.join("");
  }

  function shuffle<T>(items: T[]) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function buildRound() {
    targetSignature = randomSignature();
    const signatures = new Set([targetSignature]);
    let mutation = 0;
    while (signatures.size < 4) {
      signatures.add(mutateSignature(targetSignature, mutation));
      mutation += 1;
    }

    evidence = shuffle([...signatures]).map((signature) => ({
      id: nextEvidenceId++,
      signature,
      offsetX: 0,
      offsetY: 0,
    }));
    now = Date.now();
    revealUntil = now + REVEAL_TIME;
    draggingId = null;
    feedback = bi("Запомните контрольную сигнатуру", "Memorize the target signature");
  }

  function revealAgain() {
    if (!active || revealing) return;
    deadline -= 2000;
    now = Date.now();
    revealUntil = now + 1100;
    feedback = bi("Повторный просмотр: −2 секунды", "Replay costs 2 seconds");
  }

  function onStart(event: PointerEvent, id: number) {
    event.preventDefault();
    if (!active || revealing) return;
    const selected = evidence.find((item) => item.id === id);
    if (!selected) return;

    draggingId = id;
    dragStartX = event.clientX - selected.offsetX;
    dragStartY = event.clientY - selected.offsetY;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onMove(event: PointerEvent) {
    if (draggingId == null) return;
    evidence = evidence.map((item) =>
      item.id === draggingId
        ? {
            ...item,
            offsetX: event.clientX - dragStartX,
            offsetY: event.clientY - dragStartY,
          }
        : item
    );
  }

  function onEnd(event: PointerEvent) {
    if (draggingId == null) return;
    const droppedId = draggingId;
    draggingId = null;
    const bin = binElement?.getBoundingClientRect();
    const droppedInBin =
      bin != null &&
      event.clientX >= bin.left &&
      event.clientX <= bin.right &&
      event.clientY >= bin.top &&
      event.clientY <= bin.bottom;

    if (droppedInBin) evaluateEvidence(droppedId);
    else resetPosition(droppedId);
  }

  function onCancel() {
    if (draggingId == null) return;
    const cancelledId = draggingId;
    draggingId = null;
    resetPosition(cancelledId);
  }

  function resetPosition(id: number) {
    evidence = evidence.map((item) =>
      item.id === id ? { ...item, offsetX: 0, offsetY: 0 } : item
    );
  }

  function evaluateEvidence(id: number) {
    if (!active) return;
    const selected = evidence.find((item) => item.id === id);
    if (!selected) return;

    if (selected.signature !== targetSignature) {
      mistakes += 1;
      deadline -= 3500;
      feedback = bi("Неверная сигнатура: −3,5 секунды", "Wrong signature: −3.5 seconds");
      resetPosition(id);
      now = Date.now();
      revealUntil = now + 700;
      if (mistakes >= MAX_MISTAKES) failGame();
      return;
    }

    completed += 1;
    feedback = bi("Улика уничтожена", "Evidence destroyed");
    if (completed >= ROUND_COUNT) {
      winGame();
      return;
    }
    buildRound();
  }

  function winGame() {
    if (!active) return;
    active = false;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    finishTimer = setTimeout(() => gotoReplace("/minigamedone"), 750);
  }

  function failGame() {
    if (!active) return;
    active = false;
    failed = true;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    draggingId = null;
  }
</script>

<svelte:window
  on:pointermove={onMove}
  on:pointerup={onEnd}
  on:pointercancel={onCancel}
/>

<main class="evidence-page">
  <section class="terminal">
    <p class="eyebrow">{bi("Протокол зачистки", "Cleanup protocol")}</p>
    <h1>{bi("Уничтожение улик", "Evidence disposal")}</h1>
    <p class="description">
      {bi(
        "Запомните контрольную сигнатуру. Когда она скроется, найдите совпадающий файл и перетащите его в уничтожитель.",
        "Memorize the target signature. Once hidden, find the matching file and drag it into the shredder."
      )}
    </p>

    <div class="stats">
      <span>{bi("Уничтожено", "Destroyed")} <strong>{completed}/{ROUND_COUNT}</strong></span>
      <span>{bi("Ошибки", "Mistakes")} <strong class:danger={mistakes > 0}>{mistakes}/{MAX_MISTAKES}</strong></span>
      <span>{bi("Время", "Time")} <strong>{timeLeft}s</strong></span>
    </div>

    <div class="target-panel" class:revealing>
      <small>{revealing ? bi("ЗАПОМНИТЕ СИГНАТУРУ", "MEMORIZE SIGNATURE") : bi("СИГНАТУРА СКРЫТА", "SIGNATURE HIDDEN")}</small>
      <code>{revealing ? targetSignature : "••-••-••"}</code>
      <button type="button" disabled={revealing} on:click={revealAgain}>
        {bi("Показать снова −2с", "Reveal again −2s")}
      </button>
    </div>

    <div class="file-grid" class:locked={revealing}>
      {#each evidence as item (item.id)}
        <button
          type="button"
          class="file-card"
          class:dragging={draggingId === item.id}
          style={`transform:translate3d(${item.offsetX}px,${item.offsetY}px,0)`}
          on:pointerdown={(event) => onStart(event, item.id)}
          aria-label={revealing
            ? bi("Файл сканируется", "File is being scanned")
            : `${bi("Файл", "File")} ${item.signature}`}
        >
          <span>EV-{String(item.id).padStart(2, "0")}</span>
          <img src={file} alt="" draggable="false" />
          <code>{revealing ? bi("СКАН...", "SCAN...") : item.signature}</code>
        </button>
      {/each}
    </div>

    <div class="shredder" bind:this={binElement} class:ready={!revealing}>
      <img src={trash} alt="" draggable="false" />
      <div>
        <strong>{bi("УНИЧТОЖИТЕЛЬ", "SHREDDER")}</strong>
        <span>{revealing ? bi("Ожидание сигнатуры", "Waiting for signature") : bi("Перетащите файл сюда", "Drag file here")}</span>
      </div>
    </div>

    <p class="feedback">{feedback}</p>

    {#if failed}
      <div class="overlay">
        <strong>{timeLeft <= 0 ? bi("Время истекло", "Time expired") : bi("Зачистка провалена", "Cleanup failed")}</strong>
        <span>{bi("Следите за одной изменённой цифрой в похожих сигнатурах.", "Watch for a single changed digit in similar signatures.")}</span>
        <button type="button" on:click={startGame}>{bi("Начать заново", "Restart")}</button>
      </div>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    overflow: hidden;
    background: #030303;
  }

  .evidence-page {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding:
      10px
      max(12px, var(--safe-right))
      max(12px, var(--safe-bottom))
      max(12px, var(--safe-left));
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    background: radial-gradient(circle at top, rgba(239, 68, 68, 0.13), transparent 30rem), #030303;
    color: white;
  }

  .terminal {
    position: relative;
    flex: 0 0 auto;
    min-width: 0;
    width: min(620px, 100%);
    margin: auto 0;
    padding: clamp(15px, 4vw, 23px);
    border: 1px solid rgba(248, 113, 113, 0.22);
    border-radius: 24px;
    background: rgba(10, 6, 6, 0.97);
  }

  .eyebrow,
  small {
    margin: 0;
    color: #fca5a5;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    margin: 6px 0 8px;
    font-size: clamp(27px, 7vw, 41px);
    font-weight: 950;
    line-height: 1;
  }

  .description {
    margin: 0;
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
    line-height: 1.4;
  }

  .stats {
    margin: 12px 0 8px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .stats span {
    min-width: 0;
    padding: 8px;
    display: grid;
    gap: 2px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.48);
    font-size: 9px;
    text-transform: uppercase;
  }

  .stats strong {
    color: white;
    font-size: 15px;
  }

  .stats .danger {
    color: #f87171;
  }

  .target-panel {
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3px 10px;
    align-items: center;
    border: 1px solid rgba(248, 113, 113, 0.18);
    border-radius: 12px;
    background: #100909;
  }

  .target-panel small,
  .target-panel code {
    grid-column: 1;
  }

  .target-panel code {
    color: rgba(255, 255, 255, 0.42);
    font-size: clamp(18px, 5vw, 25px);
    font-weight: 950;
    letter-spacing: 0.12em;
  }

  .target-panel.revealing code {
    color: #fca5a5;
    text-shadow: 0 0 18px rgba(248, 113, 113, 0.4);
  }

  .target-panel button {
    grid-column: 2;
    grid-row: 1 / 3;
    padding: 9px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.05);
    color: white;
    font-size: 10px;
    font-weight: 900;
  }

  .target-panel button:disabled {
    opacity: 0.35;
  }

  .file-grid {
    position: relative;
    margin: 9px 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
  }

  .file-card {
    position: relative;
    z-index: 1;
    min-width: 0;
    padding: 15px 4px 7px;
    display: grid;
    justify-items: center;
    gap: 2px;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 12px;
    background: #0e0e0e;
    color: white;
    cursor: grab;
    touch-action: none;
    will-change: transform;
  }

  .file-card.dragging {
    z-index: 5;
    border-color: #f87171;
    cursor: grabbing;
    box-shadow: 0 14px 35px rgba(0, 0, 0, 0.65);
  }

  .file-card > span {
    position: absolute;
    top: 4px;
    left: 6px;
    color: rgba(255, 255, 255, 0.32);
    font-size: 7px;
    font-weight: 900;
  }

  .file-card img {
    width: clamp(42px, 11vw, 62px);
    height: clamp(42px, 11vw, 62px);
    object-fit: contain;
    image-rendering: pixelated;
    pointer-events: none;
    user-select: none;
  }

  .file-card code {
    font-size: clamp(8px, 2.2vw, 11px);
    font-weight: 950;
    white-space: nowrap;
  }

  .file-grid.locked .file-card {
    cursor: wait;
    opacity: 0.48;
  }

  .shredder {
    min-height: 78px;
    padding: 8px 14px;
    display: flex;
    justify-content: center;
    gap: 14px;
    align-items: center;
    border: 2px dashed rgba(248, 113, 113, 0.24);
    border-radius: 14px;
    background: rgba(127, 29, 29, 0.08);
  }

  .shredder.ready {
    border-color: rgba(248, 113, 113, 0.58);
    background: rgba(127, 29, 29, 0.15);
  }

  .shredder img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    image-rendering: pixelated;
    pointer-events: none;
  }

  .shredder div {
    display: grid;
    gap: 3px;
  }

  .shredder strong {
    color: #fca5a5;
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  .shredder span,
  .feedback {
    color: rgba(255, 255, 255, 0.55);
    font-size: 10px;
  }

  .feedback {
    min-height: 15px;
    margin: 7px 0 0;
    text-align: center;
  }

  .overlay {
    position: absolute;
    inset: 0;
    z-index: 8;
    padding: 22px;
    display: grid;
    place-content: center;
    gap: 11px;
    border-radius: 24px;
    background: rgba(0, 0, 0, 0.93);
    text-align: center;
  }

  .overlay strong {
    font-size: 24px;
  }

  .overlay span {
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
  }

  .overlay button {
    padding: 14px;
    border: 1px solid #f87171;
    border-radius: 12px;
    background: #7f1d1d;
    color: white;
    font-weight: 900;
  }

  @media (max-width: 430px) {
    .terminal { padding: 13px; }
    .target-panel { grid-template-columns: 1fr; }
    .target-panel button { grid-column: 1; grid-row: auto; }
    .file-grid { gap: 4px; }
    .file-card { padding-right: 2px; padding-left: 2px; }
  }

  @media (max-height: 720px) {
    .description { display: none; }
    .stats { margin: 7px 0; }
    .file-grid { margin: 6px 0; }
    .shredder { min-height: 66px; padding: 4px 10px; }
    .shredder img { width: 48px; height: 48px; }
  }
</style>
