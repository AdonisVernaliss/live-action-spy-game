<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";
  import { onDestroy } from "svelte";

  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  const PASSWORD_LENGTH = 5;
  const emptyscreen = Array(PASSWORD_LENGTH).fill("_");

  let numericalinput = Array(PASSWORD_LENGTH).fill(0);
  let buttonlit = [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ];

  let right = Array(PASSWORD_LENGTH).fill(false);
  let almost = Array(PASSWORD_LENGTH).fill(false);

  let inputhistory: number[][] = [];
  let righthistory: boolean[][] = [];
  let almosthistory: boolean[][] = [];

  let historylength = 0;
  let sequence: number[] = [];

  let current = 0;
  let waiting = false;
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  function schedule(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      callback();
    }, delay);
    pendingTimers.add(timer);
  }

  function gewonnen() {
    schedule(() => {
      gotoReplace("/minigamedone");
    }, 300);
  }

  function resetGame() {
    resetSequence();

    inputhistory = [];
    righthistory = [];
    almosthistory = [];

    historylength = 0;
    current = 0;
    waiting = false;

    numericalinput = Array(PASSWORD_LENGTH).fill(0);
    right = Array(PASSWORD_LENGTH).fill(false);
    almost = Array(PASSWORD_LENGTH).fill(false);
  }

  function resetSequence() {
    sequence = Array.from(
      { length: PASSWORD_LENGTH },
      () => Math.floor(Math.random() * 10)
    );
  }

  function scroll() {
    schedule(() => {
      const scrollback = document.getElementById("scrollback");

      if (scrollback != null) {
        scrollback.scrollTop = scrollback.scrollHeight;
      }
    }, 10);
  }

  function updateHistory() {
    inputhistory = [...inputhistory, numericalinput.slice()];
    righthistory = [...righthistory, right.slice()];
    almosthistory = [...almosthistory, almost.slice()];
    historylength += 1;
  }

  function resetInput() {
    updateHistory();

    waiting = false;
    right = Array(PASSWORD_LENGTH).fill(false);
    almost = Array(PASSWORD_LENGTH).fill(false);
    current = 0;

    if (historylength > 0) {
      scroll();
    }
  }

  function processInput() {
    current = 0;
    waiting = true;

    let success = true;
    const nextRight = Array(PASSWORD_LENGTH).fill(false);
    const nextAlmost = Array(PASSWORD_LENGTH).fill(false);
    const remainingDigits = new Map<number, number>();

    for (let i = 0; i < PASSWORD_LENGTH; i++) {
      if (numericalinput[i] === sequence[i]) {
        nextRight[i] = true;
      } else {
        success = false;
        remainingDigits.set(
          sequence[i],
          (remainingDigits.get(sequence[i]) || 0) + 1
        );
      }
    }

    for (let i = 0; i < PASSWORD_LENGTH; i++) {
      if (nextRight[i]) continue;
      const remaining = remainingDigits.get(numericalinput[i]) || 0;
      if (remaining > 0) {
        nextAlmost[i] = true;
        remainingDigits.set(numericalinput[i], remaining - 1);
      }
    }

    right = nextRight;
    almost = nextAlmost;

    if (success) {
      gewonnen();
    }

    resetInput();
  }

  function clickbutton(index: number) {
    if (waiting) {
      resetInput();
    }

    if (index === 10) {
      if (current > 0) {
        current -= 1;
      }

      return;
    }

    if (index === 11) {
      if (current === PASSWORD_LENGTH) {
        processInput();
      }

      return;
    }

    buttonlit[index] = true;
    buttonlit = buttonlit.slice();

    schedule(() => {
      buttonlit[index] = false;
      buttonlit = buttonlit.slice();
    }, 300);

    if (current < PASSWORD_LENGTH) {
      numericalinput[current] = index;
      numericalinput = numericalinput.slice();
      current += 1;
    }
  }

  resetGame();

  onDestroy(() => {
    for (const timer of pendingTimers) clearTimeout(timer);
    pendingTimers.clear();
  });
</script>

<main class="password-page">
  <div class="password-card">
    <div
      class="code-grid history-grid mt-4 pb-2 mb-2 h-28 border-b border-gray-400"
      id="scrollback"
    >
      {#if historylength > 0}
        {#each Array(historylength) as _, i}
          {#each Array(PASSWORD_LENGTH) as _, j}
            <div
              class="history h-min"
              class:history-right={righthistory[i][j]}
              class:history-almost={almosthistory[i][j]}
            >
              {inputhistory[i][j]}
            </div>
          {/each}
        {/each}
      {/if}
    </div>

    <div class="code-grid">
      {#each Array(PASSWORD_LENGTH) as _, i}
        <div
          class="screen"
          class:history={waiting}
          class:screen-right={right[i]}
          class:screen-almost={almost[i]}
        >
          {i < current ? numericalinput[i] : emptyscreen[i]}
        </div>
      {/each}
    </div>

    <br />

    <div class="grid grid-cols-3 grid-rows-4 gap-4 buttonpad">
      {#each Array(9) as _, i}
        <button
          class="btn"
          class:btn-light-up={buttonlit[i + 1]}
          on:click={() => clickbutton(i + 1)}
        >
          {i + 1}
        </button>
      {/each}

      <button class="btn special-btn" on:click={() => clickbutton(11)}>
        OK
      </button>

      <button
        class="btn"
        class:btn-light-up={buttonlit[0]}
        on:click={() => clickbutton(0)}
      >
        0
      </button>

      <button class="btn special-btn" on:click={() => clickbutton(10)}>
        &larr;
      </button>
    </div>

    <p class="hint-text">
      {bi("Угадайте пароль. После каждой попытки появятся подсказки.", "Guess the password. Each attempt reveals new clues.")}
    </p>
  </div>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
    overflow: hidden;
  }

  .password-page {
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    background: #000;
    color: white;
    padding:
      10px
      max(18px, var(--safe-right))
      max(18px, var(--safe-bottom))
      max(18px, var(--safe-left));
    overflow-y: auto;
  }

  .password-card {
    flex: 0 0 auto;
    min-width: 0;
    width: min(420px, 100%);
    margin: auto 0;
  }

  .buttonpad {
    height: 40svh;
  }

  .code-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: clamp(6px, 2.5vw, 14px);
  }

  .btn {
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    background: rgb(71, 85, 105);
    color: white;
  }

  #scrollback {
    max-height: 30svh;
    overflow-y: scroll;
    overflow-anchor: none;
  }

  .screen {
    border: 4px solid rgb(71, 85, 105);
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    background: rgb(71, 85, 105);
    text-align: center;
  }

  .history {
    border: 4px solid rgb(51, 65, 85);
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    text-align: center;
    background: rgb(51, 65, 85);
  }

  .btn-light-up {
    background: rgb(51, 65, 85);
  }

  .screen-right {
    border-color: rgb(34, 197, 94);
  }

  .screen-almost {
    border-color: rgb(234, 179, 8);
  }

  .history-right {
    border-color: rgb(22, 163, 74);
  }

  .history-almost {
    border-color: rgb(202, 138, 4);
  }

  .special-btn {
    background: rgb(23, 37, 84);
    border-color: rgb(23, 37, 84);
  }

  .hint-text {
    margin-top: 16px;
    color: rgb(156, 163, 175);
    font-size: 14px;
    line-height: 1.4;
  }
</style>
