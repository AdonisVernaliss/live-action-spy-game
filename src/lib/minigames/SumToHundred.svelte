<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";
  import { SUM_ROUND_PATTERN } from "$lib/minigames/sumLogic.js";
  import { onDestroy } from "svelte";

  const ROUND_PATTERN = SUM_ROUND_PATTERN;
  const BOARD_SIZE = 15;

  let numbers: number[] = [];
  let selectedIndices: number[] = [];
  let message = "";
  let round = 0;
  let waiting = false;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  let roundTimer: ReturnType<typeof setTimeout> | null = null;
  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  $: requiredCount = ROUND_PATTERN[round] || ROUND_PATTERN[ROUND_PATTERN.length - 1];
  $: selectedSum = selectedIndices.reduce((sum, index) => sum + numbers[index], 0);
  const messageText = () => message === "wrong"
    ? bi("❌ Неверно. Попробуйте снова.", "❌ Incorrect. Try again.")
    : message === "correct" ? bi("Верно.", "Correct.") : "";

  function randomInt(min: number, max: number) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(values: number[]) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [values[index], values[other]] = [values[other], values[index]];
    }
    return values;
  }

  function makeSolution(count: number) {
    const solution: number[] = [];
    let remaining = 100;

    for (let index = 0; index < count - 1; index += 1) {
      const slotsLeft = count - index - 1;
      const minimum = Math.max(8, remaining - slotsLeft * 52);
      const maximum = Math.min(52, remaining - slotsLeft * 8);
      const value = randomInt(minimum, maximum);
      solution.push(value);
      remaining -= value;
    }

    solution.push(remaining);
    return solution;
  }

  function resetNumbers() {
    const count = ROUND_PATTERN[round];
    const solution = makeSolution(count);
    const distractors = Array.from(
      { length: BOARD_SIZE - count },
      () => randomInt(7, 68)
    );
    numbers = shuffle([...solution, ...distractors]);
    selectedIndices = [];
  }

  function clearSelection() {
    if (waiting) return;
    selectedIndices = [];
    message = "";
  }

  function selectNumber(index: number) {
    if (waiting) return;

    if (selectedIndices.includes(index)) {
      selectedIndices = selectedIndices.filter((selected) => selected !== index);
      message = "";
      return;
    }

    if (selectedIndices.length >= requiredCount) return;

    const nextSelection = [...selectedIndices, index];
    selectedIndices = nextSelection;
    message = "";

    if (nextSelection.length < requiredCount) return;

    const total = nextSelection.reduce(
      (sum, selected) => sum + numbers[selected],
      0
    );

    if (total !== 100) {
      waiting = true;
      message = "wrong";
      roundTimer = setTimeout(() => {
        roundTimer = null;
        selectedIndices = [];
        waiting = false;
      }, 550);
      return;
    }

    waiting = true;
    message = "correct";

    if (round === ROUND_PATTERN.length - 1) {
      finishTimer = setTimeout(() => {
        gotoReplace("/minigamedone");
      }, 650);
    } else {
      roundTimer = setTimeout(() => {
        roundTimer = null;
        round += 1;
        waiting = false;
        message = "";
        resetNumbers();
      }, 650);
    }
  }

  resetNumbers();

  onDestroy(() => {
    if (finishTimer) clearTimeout(finishTimer);
    if (roundTimer) clearTimeout(roundTimer);
  });
</script>

<main class="sum-page">
  <section class="sum-card">
    <p class="eyebrow">{bi("Числовой анализ", "Number analysis")}</p>
    <h1>{bi("Сумма до ста", "Sum to one hundred")}</h1>
    <p class="description">{bi(`Выберите ${requiredCount} числа с суммой ровно 100.`, `Choose ${requiredCount} numbers that total exactly 100.`)}</p>
    <div class="status">
      <span>{bi("Раунд", "Round")} <strong>{round + 1}/{ROUND_PATTERN.length}</strong></span>
      <span>{bi("Выбрано", "Selected")} <strong>{selectedIndices.length}/{requiredCount}</strong></span>
      <span>{bi("Сумма", "Total")} <strong class:over={selectedSum > 100}>{selectedSum}</strong></span>
    </div>

    <div class="number-grid">
    {#each numbers as n, index}
      <button
        type="button"
        on:click={() => selectNumber(index)}
        class:selected={selectedIndices.includes(index)}
      >
        {n}
      </button>
    {/each}
    </div>

    <button
      type="button"
      on:click={clearSelection}
      class="reset-button"
      disabled={selectedIndices.length === 0 || waiting}
    >
      {bi("Сбросить", "Reset")}
    </button>

    <div class="rounds">
    {#each ROUND_PATTERN as count, i}
        <i class:complete={round > i} class:current={round === i}>{round > i ? "✓" : count}</i>
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
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    justify-content: space-between;
    gap: 8px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
  }

  .status > span {
    min-width: 0;
    display: grid;
    gap: 2px;
    overflow-wrap: anywhere;
  }

  .status strong {
    color: #7dd3fc;
    font-size: 16px;
  }

  .status strong.over {
    color: #f87171;
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

  .rounds i.current {
    border-color: #38bdf8;
    color: #7dd3fc;
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
    .number-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .number-grid button { min-height: 42px; }
  }
</style>
