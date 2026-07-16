<script lang="ts">
  import MainButton from "$lib/MainButton.svelte";
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";

  let stage = 1;

  let holdProgress = 0;
  let holdInterval: ReturnType<typeof setInterval> | null = null;

  let codeInput = "";
  const correctCode = "7319";

  let sequence = [4, 1, 7, 2];
  let sequenceInput = "";

  let error = "";
  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  function startHold() {
    if (holdInterval != null) return;

    holdInterval = setInterval(() => {
      holdProgress += 1;

      if (holdProgress >= 20) {
        stopHold();
        stage = 2;
      }
    }, 1000);
  }

  function stopHold() {
    if (holdInterval != null) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
  }

  function checkCode() {
    if (codeInput.trim() === correctCode) {
      error = "";
      stage = 3;
    } else {
      error = bi("Неверный код.", "Incorrect code.");
      codeInput = "";
    }
  }

  function checkSequence() {
    const expected = sequence.join("");

    if (sequenceInput.trim() === expected) {
      error = "";
      localStorage.setItem("currentTaskNumber", "1000");
      gotoReplace("/minigamedone");
    } else {
      error = bi("Неверная последовательность.", "Incorrect sequence.");
      sequenceInput = "";
    }
  }
</script>

<main class="secret-page">
  <section class="secret-card">
    <p class="eyebrow">{bi("Секретное дополнительное задание", "Secret extra task")}</p>

    <h1>{bi("Переопределение системы", "System override")}</h1>

    <p class="description">
      {bi("Пройдите все этапы дополнительного задания.", "Complete every stage of the extra task.")}
    </p>

    {#if error}
      <div class="error-box">{error}</div>
    {/if}

    {#if stage === 1}
      <div class="stage-box">
        <h2>{bi("Этап 1 — Ручное управление", "Stage 1 — Manual control")}</h2>

        <p>
          {bi("Удерживайте кнопку 20 секунд. При отпускании процесс приостанавливается.", "Hold the button for 20 seconds. Releasing it pauses the process.")}
        </p>

        <div class="progress-track">
          <div
            class="progress-fill"
            style="width: {(holdProgress / 20) * 100}%"
          />
        </div>

        <p class="counter">{holdProgress}/20 {bi("секунд", "seconds")}</p>

        <button
          type="button"
          class="hold-button"
          on:mousedown={startHold}
          on:mouseup={stopHold}
          on:mouseleave={stopHold}
          on:touchstart|preventDefault={startHold}
          on:touchend|preventDefault={stopHold}
        >
          {bi("Удерживайте", "Hold")}
        </button>
      </div>
    {:else if stage === 2}
      <div class="stage-box">
        <h2>{bi("Этап 2 — Код доступа", "Stage 2 — Access code")}</h2>

        <p>{bi("Введите код доступа:", "Enter the access code:")}</p>

        <div class="code-display">7319</div>

        <input
          bind:value={codeInput}
          inputmode="numeric"
          placeholder={bi("Введите код", "Enter code")}
          class="input"
        />

        <MainButton on:click={checkCode}>{bi("Подтвердить код", "Confirm code")}</MainButton>
      </div>
    {:else if stage === 3}
      <div class="stage-box">
        <h2>{bi("Этап 3 — Подтверждение последовательности", "Stage 3 — Sequence confirmation")}</h2>

        <p>{bi("Введите последовательность без пробелов:", "Enter the sequence without spaces:")}</p>

        <div class="code-display">{sequence.join(" - ")}</div>

        <input
          bind:value={sequenceInput}
          inputmode="numeric"
          placeholder={bi("Введите последовательность", "Enter sequence")}
          class="input"
        />

        <MainButton on:click={checkSequence}>{bi("Завершить задание", "Complete task")}</MainButton>
      </div>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .secret-page {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 10px max(12px, var(--safe-right)) max(12px, var(--safe-bottom)) max(12px, var(--safe-left));
    background:
      radial-gradient(circle at top, rgba(168, 85, 247, 0.18), transparent 28rem),
      #000;
    color: white;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow-y: auto;
  }

  .secret-card {
    flex: 0 0 auto;
    min-width: 0;
    width: 100%;
    max-width: 480px;
    margin: auto 0;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(8, 8, 8, 0.94);
  }

  .eyebrow {
    margin: 0;
    color: rgba(216, 180, 254, 0.9);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 8px 0 14px;
    font-size: 30px;
    line-height: 1.1;
    font-weight: 900;
  }

  h2 {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 900;
  }

  .description {
    margin: 0 0 22px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 15px;
    line-height: 1.45;
  }

  .stage-box {
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(168, 85, 247, 0.25);
    background: rgba(168, 85, 247, 0.08);
  }

  .progress-track {
    height: 16px;
    margin: 18px 0 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 999px;
    background: white;
    transition: width 0.2s linear;
  }

  .counter {
    margin: 0 0 16px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
  }

  .hold-button {
    width: 100%;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.12);
    color: white;
    font-weight: 900;
    font-size: 16px;
  }

  .code-display {
    margin: 14px 0;
    padding: 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.1);
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-align: center;
  }

  .input {
    width: 100%;
    margin-bottom: 14px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.35);
    color: white;
    font-size: 18px;
    outline: none;
  }

  .error-box {
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    background: rgba(127, 29, 29, 0.35);
    color: rgba(254, 226, 226, 0.95);
    font-size: 13px;
  }

  @media (max-width: 390px) {
    .secret-card { padding: 16px; }
    h1 { font-size: 26px; }
    .stage-box { padding: 12px; }
  }

  @media (max-height: 520px) and (orientation: landscape) {
    .secret-card { margin: 0; }
    .description { display: none; }
  }
</style>
