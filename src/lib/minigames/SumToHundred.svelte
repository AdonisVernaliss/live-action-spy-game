<script lang="ts">
  import { gotoReplace, makeNumberListWith100Sum } from "$lib/util";
  import { language } from "$lib/i18n";
  import { onDestroy } from "svelte";

  export let nRepeats = 3;
  export let numbersInMinigame = 12;

  let numbers = makeNumberListWith100Sum(numbersInMinigame);
  let firstSelectedNumber: number | null = null;
  let message = "";
  let wins = 0;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  const bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  const messageText = () => message === "wrong"
    ? bi("❌ Неверно. Попробуйте снова.", "❌ Incorrect. Try again.")
    : message === "correct" ? bi("Верно.", "Correct.") : "";

  function resetNumbers() {
    numbers = makeNumberListWith100Sum(numbersInMinigame);
  }

  function numbersSumTo100(a: number, b: number): boolean {
    return a + b === 100;
  }

  function clearNumber() {
    firstSelectedNumber = null;
  }

  function selectNumber(n: number) {
    if (firstSelectedNumber == null) {
      firstSelectedNumber = n;
      message = "";
      return;
    }

    const correctAnswer = numbersSumTo100(firstSelectedNumber, n);

    if (!correctAnswer) {
      message = "wrong";
      clearNumber();
      return;
    }

    wins += 1;
    message = "correct";

    if (wins === nRepeats) {
      finishTimer = setTimeout(() => {
        gotoReplace("/minigamedone");
      }, 300);
    } else {
      resetNumbers();
      firstSelectedNumber = null;
    }
  }

  onDestroy(() => {
    if (finishTimer) clearTimeout(finishTimer);
  });
</script>

<main class="sum-page">
  <section class="sum-card">
    <p class="eyebrow">{bi("Числовой анализ", "Number analysis")}</p>
    <h1>{bi("Сумма до ста", "Sum to one hundred")}</h1>
    <p class="description">{bi("Выберите два числа, сумма которых равна 100.", "Choose two numbers that add up to 100.")}</p>
    <div class="status">
      <span>{bi("Осталось решений", "Solutions remaining")}</span>
      <strong>{nRepeats - wins}</strong>
    </div>

    <div class="number-grid">
    {#each numbers as n}
      <button
        type="button"
        on:click={() => selectNumber(n)}
        class:selected={firstSelectedNumber === n}
      >
        {n}
      </button>
    {/each}
    </div>

    <button
      type="button"
      on:click={clearNumber}
      class="reset-button"
      disabled={firstSelectedNumber == null}
    >
      {bi("Сбросить", "Reset")}
    </button>

    <div class="rounds">
    {#each Array(nRepeats) as _, i}
        <i class:complete={wins > i}>{wins > i ? "✓" : i + 1}</i>
    {/each}
    </div>

    <p class="message" class:error={message === "wrong"}>{messageText()}</p>
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    overflow: hidden;
    background: #030405;
  }

  .sum-page {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 10px max(12px, var(--safe-right)) max(12px, var(--safe-bottom)) max(12px, var(--safe-left));
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    background: radial-gradient(circle at top, rgba(14, 165, 233, 0.14), transparent 30rem), #030405;
    color: white;
  }

  .sum-card {
    flex: 0 0 auto;
    min-width: 0;
    width: min(560px, 100%);
    margin: auto 0;
    padding: clamp(15px, 4vw, 23px);
    border: 1px solid rgba(56, 189, 248, 0.22);
    border-radius: 24px;
    background: rgba(5, 8, 12, 0.97);
  }

  .eyebrow {
    margin: 0;
    color: #7dd3fc;
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
  }

  .status {
    margin: 12px 0 8px;
    padding: 9px 11px;
    display: flex;
    justify-content: space-between;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
  }

  .status strong {
    color: #7dd3fc;
    font-size: 16px;
  }

  .number-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
  }

  .number-grid button {
    min-width: 0;
    min-height: 48px;
    padding: 8px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 11px;
    background: #111827;
    color: white;
    font-size: 18px;
    font-weight: 900;
  }

  .number-grid button.selected {
    border-color: #38bdf8;
    background: #075985;
  }

  .reset-button {
    width: 100%;
    min-height: 42px;
    margin-top: 8px;
    border: 1px solid rgba(125, 211, 252, 0.35);
    border-radius: 10px;
    background: #0c2635;
    color: white;
    font-weight: 900;
  }

  .reset-button:disabled {
    opacity: 0.38;
  }

  .rounds {
    margin-top: 8px;
    display: flex;
    justify-content: center;
    gap: 7px;
  }

  .rounds i {
    width: 29px;
    height: 29px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    font-style: normal;
    font-weight: 900;
  }

  .rounds i.complete {
    border-color: #4ade80;
    color: #86efac;
    background: rgba(22, 101, 52, 0.25);
  }

  .message {
    min-height: 18px;
    margin: 7px 0 0;
    color: #86efac;
    font-size: 11px;
    text-align: center;
  }

  .message.error {
    color: #fca5a5;
  }

  @media (max-height: 520px) and (orientation: landscape) {
    .sum-card { margin: 0; }
    .description { display: none; }
    .status { margin: 7px 0; }
    .number-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .number-grid button { min-height: 42px; }
  }
</style>
