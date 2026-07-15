<script lang="ts">
  import { lobbyStore, playerStore } from "$lib/stores";
  import { language } from "$lib/i18n";
  import { emitGameAction } from "$lib/websocket";
  import { gotoReplace } from "$lib/util";
  import { onDestroy, onMount } from "svelte";

  const bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  let now = Date.now();
  let mounted = false;
  let sawActive = false;
  let completionHandled = false;
  let cancelling = false;
  let clock: ReturnType<typeof setInterval> | null = null;
  let redirectTimer: ReturnType<typeof setTimeout> | null = null;

  $: sync = $lobbyStore?.playerSync;
  $: if (sync?.state === "active") sawActive = true;
  $: progress = sync?.state === "active"
    ? Math.max(
        0,
        Math.min(
          100,
          Math.floor(((now - sync.startedAt) / sync.durationMs) * 100)
        )
      )
    : sync?.state === "completed" ? 100 : 0;
  $: secondsLeft = sync?.state === "waiting"
    ? Math.max(0, Math.ceil((sync.expiresAt - now) / 1000))
    : sync?.state === "active"
      ? Math.max(0, Math.ceil((sync.endsAt - now) / 1000))
      : 0;

  $: if (mounted && $playerStore?.status === "dead") {
    gotoReplace("/killed");
  }
  $: if (mounted && $playerStore?.status === "foundDead") {
    gotoReplace("/dead");
  }
  $: if (
    mounted &&
    sawActive &&
    sync?.state === "completed" &&
    !completionHandled
  ) {
    completionHandled = true;
    redirectTimer = setTimeout(() => gotoReplace("/game"), 1500);
  }

  onMount(() => {
    mounted = true;
    now = Date.now();
    clock = setInterval(() => (now = Date.now()), 100);
  });

  onDestroy(() => {
    if (clock) clearInterval(clock);
    if (redirectTimer) clearTimeout(redirectTimer);
  });

  async function cancelWaiting() {
    if (cancelling) return;
    cancelling = true;
    const result = await emitGameAction({ action: "cancelPlayerSync" });
    cancelling = false;
    if (result.success) gotoReplace("/game");
  }
</script>

<svelte:head>
  <title>{bi("Синхронизация — Протокол 150", "Synchronization — Protocol 150")}</title>
</svelte:head>

<main class="sync-page">
  <section class="sync-console" class:active={sync?.state === "active"}>
    <p class="eyebrow">{bi("ЗАЩИЩЁННЫЙ КАНАЛ", "SECURE CHANNEL")}</p>

    {#if sync?.state === "waiting"}
      <h1>{bi("Ожидание ответа", "Waiting for response")}</h1>
      <p class="description">
        {bi(
          `Передайте телефон ${sync.partnerName} или попросите этого игрока отсканировать вашу метку. Запрос действует ещё ${secondsLeft} сек.`,
          `Ask ${sync.partnerName} to scan your tag. The request remains active for ${secondsLeft}s.`
        )}
      </p>

      <div class="waiting-signal" aria-label={bi("Ожидание обратного сканирования", "Waiting for reverse scan")}>
        <i></i><i></i><i></i>
      </div>

      <div class="partner-card">
        <span>{bi("ПАРТНЁР", "PARTNER")}</span>
        <strong>{sync.partnerName}</strong>
        <small>{bi("нужно обратное сканирование", "reverse scan required")}</small>
      </div>

      <button type="button" class="secondary" disabled={cancelling} on:click={cancelWaiting}>
        {cancelling ? bi("Отмена…", "Cancelling…") : bi("Отменить запрос", "Cancel request")}
      </button>
    {:else if sync?.state === "active"}
      <h1>{bi("Синхронизация", "Synchronization")}</h1>
      <p class="description">
        {bi(
          `Канал с ${sync.partnerName} устанавливается. Оставайтесь рядом и не закрывайте экран до 100%.`,
          `Establishing a channel with ${sync.partnerName}. Stay together and keep this screen open until 100%.`
        )}
      </p>

      <div class="percentage">{progress}%</div>
      <div
        class="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <b style={`width:${progress}%`}></b>
      </div>

      <div class="sync-stats">
        <div><span>{bi("ПАРТНЁР", "PARTNER")}</span><strong>{sync.partnerName}</strong></div>
        <div><span>{bi("ОСТАЛОСЬ", "REMAINING")}</span><strong>{secondsLeft}s</strong></div>
      </div>

      <p class="hold-message">
        {progress < 100
          ? bi("Удерживайте защищённый канал…", "Hold the secure channel…")
          : bi("Подтверждение результата…", "Confirming result…")}
      </p>
    {:else if sync?.state === "completed"}
      <div class="completion-mark">✓</div>
      <h1>{bi("Канал подтверждён", "Channel verified")}</h1>
      <p class="description">
        {bi(
          "Обязательная синхронизация выполнена. Личные задания разблокированы.",
          "Required synchronization is complete. Personal tasks are unlocked."
        )}
      </p>
      <div class="percentage complete">100%</div>
      <div class="progress-track complete"><b style="width:100%"></b></div>
      <button type="button" class="primary" on:click={() => gotoReplace("/game")}>
        {bi("Вернуться к заданиям", "Return to tasks")}
      </button>
    {:else if sync?.state === "incoming"}
      <h1>{bi("Нужно ответное сканирование", "Reverse scan required")}</h1>
      <p class="description">
        {bi(
          `${sync.partnerName} ожидает вас. Вернитесь в игру и отсканируйте метку этого игрока.`,
          `${sync.partnerName} is waiting. Return to the game and scan this player's tag.`
        )}
      </p>
      <button type="button" class="primary" on:click={() => gotoReplace("/game")}>
        {bi("Вернуться к сканеру", "Return to scanner")}
      </button>
    {:else}
      <h1>{bi("Запрос завершён", "Request ended")}</h1>
      <p class="description">
        {bi(
          "Синхронизация не была начата. Вернитесь и повторите взаимное сканирование.",
          "Synchronization did not start. Return and repeat the mutual scan."
        )}
      </p>
      <button type="button" class="primary" on:click={() => gotoReplace("/game")}>
        {bi("Вернуться в игру", "Return to game")}
      </button>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    overflow: hidden;
    background: #020507;
  }

  .sync-page {
    width: 100%;
    height: var(--app-height);
    min-height: 0;
    padding:
      max(62px, calc(var(--safe-top) + 52px))
      max(12px, var(--safe-right))
      max(12px, var(--safe-bottom))
      max(12px, var(--safe-left));
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    background:
      radial-gradient(circle at 50% 0, rgba(14, 165, 233, 0.2), transparent 30rem),
      #020507;
    color: white;
  }

  .sync-console {
    width: min(520px, 100%);
    min-width: 0;
    margin: auto 0;
    padding: clamp(20px, 6vw, 32px);
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 26px;
    background: rgba(4, 12, 18, 0.97);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.5);
    text-align: center;
  }

  .sync-console.active {
    box-shadow: 0 0 60px rgba(14, 165, 233, 0.1);
  }

  .eyebrow {
    margin: 0;
    color: #7dd3fc;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.14em;
  }

  h1 {
    margin: 9px 0 0;
    font-size: clamp(28px, 8vw, 42px);
    font-weight: 950;
    line-height: 1;
  }

  .description {
    margin: 15px 0 0;
    color: rgba(255, 255, 255, 0.67);
    font-size: 14px;
    line-height: 1.5;
  }

  .percentage {
    margin-top: 24px;
    color: #e0f2fe;
    font-size: clamp(54px, 18vw, 82px);
    font-weight: 950;
    line-height: 1;
    text-shadow: 0 0 28px rgba(56, 189, 248, 0.45);
  }

  .percentage.complete { color: #bbf7d0; }

  .progress-track {
    height: 18px;
    margin-top: 16px;
    overflow: hidden;
    border: 1px solid rgba(125, 211, 252, 0.32);
    border-radius: 999px;
    background: #07131b;
  }

  .progress-track b {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #0284c7, #38bdf8, #67e8f9);
    box-shadow: 0 0 20px #0ea5e9;
    transition: width 0.12s linear;
  }

  .progress-track.complete b {
    background: linear-gradient(90deg, #16a34a, #4ade80);
  }

  .sync-stats {
    margin-top: 18px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
  }

  .sync-stats div,
  .partner-card {
    min-width: 0;
    padding: 12px;
    display: grid;
    gap: 4px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.045);
  }

  .sync-stats span,
  .partner-card span {
    color: rgba(255, 255, 255, 0.44);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.1em;
  }

  .sync-stats strong,
  .partner-card strong {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 15px;
  }

  .partner-card { margin-top: 22px; }
  .partner-card small { color: #7dd3fc; }

  .hold-message {
    min-height: 20px;
    margin: 17px 0 0;
    color: #7dd3fc;
    font-size: 12px;
    font-weight: 900;
  }

  .waiting-signal {
    height: 58px;
    margin-top: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 9px;
  }

  .waiting-signal i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #38bdf8;
    animation: waiting 1s ease-in-out infinite;
  }

  .waiting-signal i:nth-child(2) { animation-delay: 0.16s; }
  .waiting-signal i:nth-child(3) { animation-delay: 0.32s; }

  .completion-mark {
    width: 76px;
    height: 76px;
    margin: 0 auto 14px;
    display: grid;
    place-items: center;
    border: 2px solid #4ade80;
    border-radius: 50%;
    background: rgba(22, 101, 52, 0.3);
    color: #bbf7d0;
    font-size: 40px;
    font-weight: 950;
  }

  .primary,
  .secondary {
    width: 100%;
    min-height: 48px;
    margin-top: 22px;
    padding: 12px 16px;
    border-radius: 13px;
    color: white;
    font-weight: 900;
  }

  .primary {
    border: 1px solid #38bdf8;
    background: #075985;
  }

  .secondary {
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.07);
  }

  @keyframes waiting {
    0%, 100% { transform: translateY(0); opacity: 0.35; }
    50% { transform: translateY(-10px); opacity: 1; }
  }

  @media (max-height: 600px) and (orientation: landscape) {
    .sync-page { padding-top: max(52px, calc(var(--safe-top) + 44px)); }
    .sync-console { margin: 0; padding: 16px; }
    .description { margin-top: 9px; }
    .percentage { margin-top: 10px; font-size: 46px; }
    .progress-track { margin-top: 8px; }
    .sync-stats { margin-top: 9px; }
    .hold-message { margin-top: 8px; }
  }
</style>
