<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";
  import { onDestroy } from "svelte";

  type Phase = "idle" | "showing" | "input" | "failed" | "won";

  const CELL_COUNT = 12;
  const TOTAL_ROUNDS = 6;
  const MAX_STRIKES = 3;
  const GAME_TIME = 72;

  let pattern: number[] = [];
  let round = 0;
  let inputIndex = 0;
  let strikes = 0;
  let timeLeft = GAME_TIME;
  let deadline = 0;
  let phase: Phase = "idle";
  let litCell = -1;
  let pressedCell = -1;
  let feedback = "";
  let playbackTimer: ReturnType<typeof setTimeout> | null = null;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let gameTimer: ReturnType<typeof setInterval> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;

  const bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  const patternLengthForRound = (targetRound: number) =>
    Math.max(3, targetRound + 2);
  $: expectedLength = patternLengthForRound(round);

  onDestroy(cleanup);

  function startGame() {
    cleanup();
    round = 1;
    inputIndex = 0;
    strikes = 0;
    timeLeft = GAME_TIME;
    deadline = Date.now() + GAME_TIME * 1000;
    phase = "showing";
    feedback = bi("Приготовьтесь к первому шаблону", "Prepare for the first pattern");
    gameTimer = setInterval(tick, 100);
    prepareRound(550);
  }

  function tick() {
    if (phase === "idle" || phase === "failed" || phase === "won") return;
    timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (timeLeft <= 0) failGame(bi("Время истекло", "Time expired"));
  }

  function makePattern(length: number) {
    const next: number[] = [];
    while (next.length < length) {
      const cell = Math.floor(Math.random() * CELL_COUNT);
      if (cell !== next[next.length - 1]) next.push(cell);
    }
    return next;
  }

  function prepareRound(delay: number) {
    clearPlayback();
    // startGame resets round and prepares the first pattern in the same event.
    // Calculate from round directly instead of waiting for Svelte's reactive flush.
    const patternLength = patternLengthForRound(round);
    pattern = makePattern(patternLength);
    inputIndex = 0;
    litCell = -1;
    phase = "showing";
    feedback = bi(
      `Раунд ${round}: запомните ${patternLength} сигналов`,
      `Round ${round}: memorize ${patternLength} signals`
    );
    playbackTimer = setTimeout(() => playStep(0), delay);
  }

  function playStep(index: number) {
    if (phase !== "showing") return;
    if (index >= pattern.length) {
      litCell = -1;
      phase = "input";
      feedback = bi("Теперь повторите шаблон", "Now repeat the pattern");
      return;
    }

    const lightDuration = Math.max(280, 620 - (round - 1) * 58);
    const gapDuration = Math.max(90, 155 - (round - 1) * 10);
    litCell = pattern[index];
    playbackTimer = setTimeout(() => {
      litCell = -1;
      playbackTimer = setTimeout(() => playStep(index + 1), gapDuration);
    }, lightDuration);
  }

  function pressCell(event: PointerEvent, cell: number) {
    event.preventDefault();
    if (phase !== "input") return;

    pressedCell = cell;
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressedCell = -1;
      pressTimer = null;
    }, 180);

    if (cell !== pattern[inputIndex]) {
      strikes += 1;
      inputIndex = 0;
      feedback = bi("Ошибка — создан новый шаблон этого раунда", "Mistake — a new pattern was generated");
      if (strikes >= MAX_STRIKES) {
        failGame(bi("Допущено три ошибки", "Three mistakes made"));
      } else {
        phase = "showing";
        playbackTimer = setTimeout(() => prepareRound(400), 850);
      }
      return;
    }

    inputIndex += 1;
    feedback = bi(
      `Принято ${inputIndex}/${pattern.length}`,
      `Accepted ${inputIndex}/${pattern.length}`
    );
    if (inputIndex < pattern.length) return;

    if (round >= TOTAL_ROUNDS) {
      winGame();
      return;
    }

    round += 1;
    phase = "showing";
    feedback = bi("Раунд пройден", "Round complete");
    playbackTimer = setTimeout(() => prepareRound(350), 700);
  }

  function winGame() {
    phase = "won";
    feedback = bi("Последовательность подтверждена", "Sequence verified");
    clearPlayback();
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    finishTimer = setTimeout(() => gotoReplace("/minigamedone"), 800);
  }

  function failGame(reason: string) {
    phase = "failed";
    feedback = reason;
    litCell = -1;
    clearPlayback();
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
  }

  function clearPlayback() {
    if (playbackTimer) clearTimeout(playbackTimer);
    playbackTimer = null;
  }

  function cleanup() {
    clearPlayback();
    if (pressTimer) clearTimeout(pressTimer);
    if (gameTimer) clearInterval(gameTimer);
    if (finishTimer) clearTimeout(finishTimer);
    pressTimer = null;
    gameTimer = null;
    finishTimer = null;
  }
</script>

<main class="sequence-page">
  <section class="console">
    <p class="eyebrow">{bi("Проверка памяти", "Memory verification")}</p>
    <h1>{bi("Последовательность", "Sequence")}</h1>
    <p class="description">
      {bi(
        "Запоминайте порядок вспышек и повторяйте его. Каждый раунд добавляет сигнал и ускоряет показ; после ошибки создаётся новый шаблон.",
        "Memorize the flashes and repeat them. Every round adds a signal and speeds playback up; a mistake creates a new pattern."
      )}
    </p>

    <div class="stats">
      <div><small>{bi("Раунд", "Round")}</small><strong>{round || 1}/{TOTAL_ROUNDS}</strong></div>
      <div><small>{bi("Сигналы", "Signals")}</small><strong>{phase === "input" ? inputIndex : 0}/{round ? expectedLength : 3}</strong></div>
      <div><small>{bi("Ошибки", "Mistakes")}</small><strong class:danger={strikes > 0}>{strikes}/{MAX_STRIKES}</strong></div>
      <div><small>{bi("Время", "Time")}</small><strong>{timeLeft}s</strong></div>
    </div>

    <div class="sequence-grid" class:locked={phase !== "input"}>
      {#each Array(CELL_COUNT) as _, cell}
        <button
          type="button"
          class="sequence-node"
          class:lit={litCell === cell}
          class:pressed={pressedCell === cell}
          disabled={phase !== "input"}
          aria-label={bi(`Узел ${cell + 1}`, `Node ${cell + 1}`)}
          on:pointerdown={(event) => pressCell(event, cell)}
        >
          <span>{String(cell + 1).padStart(2, "0")}</span>
          <i></i>
        </button>
      {/each}
    </div>

    <div class="game-status" class:error={phase === "failed"}>
      <span>{feedback || bi("Нажмите «Начать проверку»", "Press “Start verification”")}</span>
      {#if phase === "showing"}<strong>{bi("СМОТРИТЕ", "WATCH")}</strong>{/if}
      {#if phase === "input"}<strong>{bi("ПОВТОРЯЙТЕ", "REPEAT")}</strong>{/if}
    </div>

    {#if phase === "idle" || phase === "failed"}
      <button type="button" class="start-button" on:click={startGame}>
        {phase === "failed" ? bi("Начать заново", "Restart") : bi("Начать проверку", "Start verification")}
      </button>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    overflow: hidden;
    background: #020503;
  }

  .sequence-page {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 10px max(12px, var(--safe-right)) max(12px, var(--safe-bottom)) max(12px, var(--safe-left));
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    background: radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 30rem), #020503;
    color: white;
  }

  .console {
    position: relative;
    min-width: 0;
    width: min(610px, 100%);
    margin: auto 0;
    padding: clamp(14px, 4vw, 22px);
    border: 1px solid rgba(74, 222, 128, 0.24);
    border-radius: 24px;
    background: rgba(5, 10, 7, 0.97);
  }

  .eyebrow,
  small {
    margin: 0;
    color: #86efac;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    margin: 5px 0 8px;
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
    margin: 12px 0 9px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .stats div {
    min-width: 0;
    padding: 7px;
    display: grid;
    gap: 2px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
  }

  .stats strong {
    font-size: 15px;
  }

  .stats .danger {
    color: #f87171;
  }

  .sequence-grid {
    width: min(430px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(5px, 1.7vw, 9px);
  }

  .sequence-node {
    position: relative;
    min-width: 0;
    aspect-ratio: 1.14;
    padding: 0;
    border: 1px solid rgba(74, 222, 128, 0.25);
    border-radius: clamp(9px, 2.5vw, 14px);
    overflow: hidden;
    background: #0a1710;
    color: rgba(255, 255, 255, 0.35);
    touch-action: manipulation;
  }

  .sequence-node span {
    position: absolute;
    top: 5px;
    left: 7px;
    font-size: 8px;
    font-weight: 900;
  }

  .sequence-node i {
    position: absolute;
    width: 34%;
    aspect-ratio: 1;
    top: 33%;
    left: 33%;
    border-radius: 50%;
    background: #14532d;
    box-shadow: 0 0 0 7px rgba(20, 83, 45, 0.13);
  }

  .sequence-node.lit {
    border-color: #bbf7d0;
    background: #16a34a;
    color: white;
    box-shadow: 0 0 22px rgba(74, 222, 128, 0.65);
  }

  .sequence-node.lit i {
    background: white;
    box-shadow: 0 0 18px white;
  }

  .sequence-node.pressed {
    transform: scale(0.92);
    border-color: #86efac;
  }

  .sequence-node:disabled {
    opacity: 0.72;
  }

  .game-status {
    min-height: 34px;
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
  }

  .game-status strong {
    flex: 0 0 auto;
    color: #86efac;
    font-size: 10px;
    letter-spacing: 0.08em;
  }

  .game-status.error,
  .game-status.error strong {
    color: #fca5a5;
  }

  .start-button {
    width: 100%;
    min-height: 48px;
    padding: 12px;
    border: 1px solid #4ade80;
    border-radius: 13px;
    background: #166534;
    color: white;
    font-weight: 950;
  }

  @media (max-width: 370px) {
    .console { padding: 12px; }
    .stats { gap: 4px; }
    .stats div { padding: 6px 4px; }
    .stats small { font-size: 8px; }
    .stats strong { font-size: 13px; }
  }

  @media (max-height: 650px) {
    .console { margin: 0; }
    .description { display: none; }
    .stats { margin: 7px 0; }
    .game-status { min-height: 25px; margin-top: 4px; }
  }
</style>
