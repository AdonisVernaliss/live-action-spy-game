<script lang="ts">
  import { dev } from "$lib/consts";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction } from "$lib/websocket";
  import { t } from "$lib/i18n";
  import { MEETING_BUTTON_CD } from "../../../server/consts";

  $: secondsLeft =
    $lobbyStore?.status.state === "started"
      ? Math.max(0, $lobbyStore.status.countDown)
      : 0;
  $: meetingsLeft = Math.max(0, $playerStore?.emergencyMeetingsLeft ?? 0);
  $: canCallMeeting = dev || (secondsLeft === 0 && meetingsLeft > 0);
  $: timerProgress = Math.min(1, secondsLeft / MEETING_BUTTON_CD) * 360;

  function callMeeting() {
    emitGameAction({ action: "callMeeting" });
  }

  function gobackHandler() {
    gotoReplace("/game");
  }
</script>

{#if $lobbyStore != null && $lobbyStore.status.state === "started"}
  <main class="meeting-button-page">
    <section class="meeting-console" class:ready={canCallMeeting}>
      <header>
        <p class="eyebrow">{$t("meetingButton.eyebrow")}</p>
        <h1>{$t("meetingButton.title")}</h1>
        <p class="description">
          {secondsLeft > 0
            ? $t("meetingButton.lockedText")
            : meetingsLeft > 0
              ? $t("meetingButton.readyText")
              : $t("meetingButton.emptyText")}
        </p>
      </header>

      <div
        class="readiness-dial"
        class:ready={canCallMeeting}
        style={`--timer-progress:${timerProgress}deg`}
        aria-label={secondsLeft > 0
          ? $t("meetingButton.left", { seconds: secondsLeft })
          : $t("meetingButton.ready")}
      >
        <div class="dial-core">
          <span class="alarm-mark" aria-hidden="true"></span>
          {#if secondsLeft > 0}
            <strong>{secondsLeft}</strong>
            <small>{$t("meetingButton.seconds")}</small>
          {:else}
            <strong class="ready-label">{$t("meetingButton.ready")}</strong>
          {/if}
        </div>
      </div>

      <div class="meeting-stock">
        <span>{$t("meetingButton.available")}</span>
        <strong>{meetingsLeft}</strong>
        <div class="stock-pips" aria-hidden="true">
          {#each Array(Math.max(1, meetingsLeft)) as _, index}
            <i class:active={index < meetingsLeft}></i>
          {/each}
        </div>
      </div>

      <button
        type="button"
        class="call-button"
        disabled={!canCallMeeting}
        on:click={callMeeting}
      >
        <span>{$t("meetingButton.call")}</span>
        <small>
          {canCallMeeting
            ? $t("meetingButton.confirmHint")
            : $t("meetingButton.left", { seconds: secondsLeft })}
        </small>
      </button>

      {#if dev}
        <p class="dev-note">{$t("meetingButton.dev")}</p>
      {/if}

      <button type="button" class="back-button" on:click={gobackHandler}>
        <span aria-hidden="true">←</span>
        {$t("meetingButton.back")}
      </button>
    </section>
  </main>
{/if}

<style>
  :global(html),
  :global(body) { background: #000; }

  .meeting-button-page {
    min-height: var(--app-height);
    width: 100%;
    padding:
      max(70px, calc(var(--safe-top) + 58px))
      max(16px, var(--safe-right))
      max(20px, var(--safe-bottom))
      max(16px, var(--safe-left));
    display: grid;
    place-items: center;
    color: white;
    background:
      radial-gradient(circle at 50% 23%, rgba(245, 158, 11, 0.16), transparent 22rem),
      radial-gradient(circle at 14% 86%, rgba(239, 68, 68, 0.08), transparent 18rem),
      #000;
  }

  .meeting-console {
    width: min(100%, 460px);
    padding: clamp(22px, 6vw, 30px);
    border: 1px solid rgba(251, 191, 36, 0.22);
    border-radius: 28px;
    background: rgba(12, 10, 7, 0.94);
    text-align: center;
    box-shadow: 0 28px 100px rgba(0, 0, 0, 0.64);
  }

  .meeting-console.ready {
    border-color: rgba(248, 113, 113, 0.34);
    box-shadow: 0 28px 100px rgba(0, 0, 0, 0.64), inset 0 0 40px rgba(239, 68, 68, 0.035);
  }

  .eyebrow {
    margin: 0;
    color: #fbbf24;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h1 {
    margin: 9px 0 9px;
    font-size: clamp(28px, 8vw, 38px);
    font-weight: 950;
    line-height: 1.04;
    letter-spacing: -0.03em;
  }

  .description {
    max-width: 350px;
    margin: 0 auto;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 1.5;
  }

  .readiness-dial {
    --timer-progress: 0deg;
    width: 152px;
    height: 152px;
    margin: 24px auto 18px;
    padding: 7px;
    border-radius: 50%;
    background: conic-gradient(#fbbf24 var(--timer-progress), rgba(255, 255, 255, 0.08) 0);
    box-shadow: 0 0 32px rgba(245, 158, 11, 0.09);
    transition: background 300ms ease;
  }

  .readiness-dial.ready {
    background: conic-gradient(#f87171 360deg, #f87171 0);
    box-shadow: 0 0 36px rgba(239, 68, 68, 0.18);
  }

  .dial-core {
    width: 100%;
    height: 100%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #0d0c0a;
  }

  .alarm-mark {
    width: 25px;
    height: 13px;
    margin-bottom: 6px;
    border: 2px solid #fbbf24;
    border-bottom: 0;
    border-radius: 20px 20px 3px 3px;
    box-shadow: 0 0 13px rgba(251, 191, 36, 0.28);
  }

  .ready .alarm-mark { border-color: #f87171; }

  .dial-core strong {
    font-size: 48px;
    font-weight: 950;
    line-height: 0.95;
  }

  .dial-core .ready-label {
    color: #fecaca;
    font-size: 17px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .dial-core small {
    margin-top: 5px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .meeting-stock {
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 15px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 12px;
    background: rgba(255, 255, 255, 0.035);
    color: rgba(255, 255, 255, 0.62);
    font-size: 11px;
    font-weight: 850;
    text-align: left;
  }

  .meeting-stock strong {
    grid-row: 1 / 3;
    grid-column: 2;
    color: white;
    font-size: 26px;
  }

  .stock-pips { display: flex; gap: 5px; }
  .stock-pips i {
    width: 18px;
    height: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }
  .stock-pips i.active { background: #fbbf24; }

  .call-button {
    width: 100%;
    min-height: 66px;
    margin-top: 14px;
    padding: 12px 18px;
    border: 1px solid rgba(248, 113, 113, 0.75);
    border-radius: 17px;
    display: grid;
    place-items: center;
    gap: 3px;
    background: linear-gradient(180deg, rgba(220, 38, 38, 0.34), rgba(127, 29, 29, 0.28));
    color: #fff;
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.09), 0 14px 38px rgba(127, 29, 29, 0.18);
  }

  .call-button span { font-size: 17px; font-weight: 950; }
  .call-button small { color: rgba(254, 226, 226, 0.62); font-size: 9px; font-weight: 800; }
  .call-button:not(:disabled):active { transform: translateY(1px); background: rgba(220, 38, 38, 0.42); }
  .call-button:disabled {
    border-color: rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.045);
    color: rgba(255, 255, 255, 0.4);
    box-shadow: none;
  }

  .dev-note { margin: 9px 0 0; color: rgba(255, 255, 255, 0.36); font-size: 9px; }

  .back-button {
    margin-top: 15px;
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.54);
    font-size: 12px;
    font-weight: 800;
  }

  .back-button:focus-visible,
  .call-button:focus-visible { outline: 2px solid #fbbf24; outline-offset: 3px; }

  @media (max-height: 700px) {
    .meeting-button-page { align-items: start; }
    .readiness-dial { width: 126px; height: 126px; margin: 17px auto 13px; }
    .dial-core strong { font-size: 40px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .readiness-dial { transition: none; }
  }
</style>
