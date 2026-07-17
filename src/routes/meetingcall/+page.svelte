<script lang="ts">
  import MainButton from "$lib/MainButton.svelte";
  import ScanButton from "$lib/ScanButton.svelte";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction } from "$lib/websocket";
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";

  let meetingCall = "meeting.called";

  onMount(() => {
    if ($lobbyStore != null && $lobbyStore.status.state === "meetingCalled") {
      if ($lobbyStore.status.type === "emergency") {
        meetingCall = "meeting.emergency";
      } else {
        meetingCall = "meeting.body";
      }
    }

    const unsubLobby = lobbyStore.subscribe((lobby) => {
      if (lobby == null || $playerStore == null) return;

      if (
        lobby.status.state === "meetingCalled" &&
        lobby.status.presentPlayers[$playerStore.color]
      ) {
        gotoReplace("/awaitMeeting");
      } else if (lobby.status.state === "meeting") {
        gotoReplace("/vote");
      }
    });

    return unsubLobby;
  });

  async function enterMeeting() {
    const result = await emitGameAction({ action: "enterMeeting" });
    if (result.success) gotoReplace("/awaitMeeting");
  }

  function handleScan(contents: string) {
    const [type] = contents.split(":");

    if (type === "meeting") {
      enterMeeting();
    }
  }
</script>

<main class="meeting-page">
  <section class="meeting-card">
    <div class="meeting-signal" aria-hidden="true">
      <span class="signal-ring ring-a"></span>
      <span class="signal-ring ring-b"></span>
      <span class="signal-core">!</span>
    </div>

    <header>
      <p class="eyebrow">{$t("meeting.eyebrow")}</p>
      <h1>{$t(meetingCall)}</h1>
    </header>

    {#if $playerStore?.status === "alive"}
      <p class="description">
        {$t("meeting.go")}
      </p>

      <div class="arrival-console">
        <div class="method-heading">
          <span class="method-number">01</span>
          <div>
            <p class="scan-title">{$t("meeting.nfc")}</p>
            <p class="scan-text">{$t("meeting.nfcHint")}</p>
          </div>
        </div>

        <ScanButton on:scanned={({ detail }) => handleScan(detail.result)} />

        <div class="method-divider"><span>{$t("meeting.or")}</span></div>

        <div class="manual-arrival">
          <div class="method-heading compact">
            <span class="method-number">02</span>
            <div>
              <p class="fallback-title">{$t("meeting.noNfc")}</p>
              <p class="fallback-text">{$t("meeting.noNfcHint")}</p>
            </div>
          </div>

          <MainButton on:click={enterMeeting}>
            {$t("meeting.arrived")}
          </MainButton>
        </div>
      </div>
    {:else}
      <div class="spectator-box">
        <span class="spectator-icon" aria-hidden="true">○</span>
        <p class="fallback-title">{$t("meeting.spectator")}</p>
        <p class="fallback-text">
          {$t("meeting.spectatorText")}
        </p>
      </div>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .meeting-page {
    min-height: var(--app-height);
    width: 100%;
    padding:
      max(70px, calc(var(--safe-top) + 58px))
      max(16px, var(--safe-right))
      max(20px, var(--safe-bottom))
      max(16px, var(--safe-left));
    background:
      radial-gradient(circle at 50% 19%, rgba(245, 158, 11, 0.17), transparent 25rem),
      radial-gradient(circle at 10% 88%, rgba(239, 68, 68, 0.07), transparent 18rem),
      #000;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .meeting-card {
    width: 100%;
    max-width: 460px;
    padding: clamp(22px, 6vw, 30px);
    border-radius: 28px;
    border: 1px solid rgba(251, 191, 36, 0.18);
    background: rgba(12, 10, 7, 0.94);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
    text-align: center;
  }

  .meeting-signal {
    position: relative;
    width: 94px;
    height: 94px;
    margin: 0 auto 15px;
    display: grid;
    place-items: center;
  }

  .signal-ring {
    position: absolute;
    inset: 0;
    border: 1px solid rgba(251, 191, 36, 0.28);
    border-radius: 50%;
    animation: meeting-pulse 2.2s ease-out infinite;
  }

  .ring-b { animation-delay: 1.1s; }

  .signal-core {
    position: relative;
    z-index: 1;
    width: 58px;
    height: 58px;
    border: 1px solid rgba(251, 191, 36, 0.45);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(120, 53, 15, 0.32);
    color: #fde68a;
    font-size: 28px;
    font-weight: 950;
    box-shadow: 0 0 26px rgba(245, 158, 11, 0.12);
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
    margin: 8px 0 11px;
    font-size: clamp(28px, 8vw, 38px);
    line-height: 1.05;
    font-weight: 950;
    letter-spacing: -0.035em;
  }

  .description {
    max-width: 350px;
    margin: 0 auto 20px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 1.5;
  }

  .arrival-console {
    padding: 15px;
    border: 1px solid rgba(251, 191, 36, 0.14);
    border-radius: 19px;
    background: rgba(255, 255, 255, 0.035);
    text-align: left;
  }

  .method-heading {
    margin-bottom: 12px;
    display: grid;
    grid-template-columns: 25px minmax(0, 1fr);
    align-items: start;
    gap: 10px;
  }

  .method-heading.compact { margin: 0; }

  .method-number {
    color: #fbbf24;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.05em;
  }

  .scan-title,
  .fallback-title {
    margin: 0;
    font-size: 13px;
    font-weight: 950;
  }

  .scan-text,
  .fallback-text {
    margin: 4px 0 0;
    color: rgba(255, 255, 255, 0.54);
    font-size: 10px;
    line-height: 1.4;
  }

  .method-divider {
    margin: 14px 0;
    display: flex;
    align-items: center;
    gap: 9px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .method-divider::before,
  .method-divider::after { content: ""; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); }

  .manual-arrival {
    padding: 12px;
    border: 1px solid rgba(74, 222, 128, 0.14);
    border-radius: 15px;
    display: grid;
    gap: 12px;
    background: rgba(34, 197, 94, 0.04);
  }

  .spectator-box {
    padding: 20px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 18px;
    background: rgba(148, 163, 184, 0.06);
  }

  .spectator-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 10px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: rgba(226, 232, 240, 0.64);
    font-size: 25px;
  }

  @keyframes meeting-pulse {
    0% { transform: scale(0.55); opacity: 0; }
    18% { opacity: 1; }
    100% { transform: scale(1); opacity: 0; }
  }

  @media (max-height: 720px) {
    .meeting-page { align-items: start; }
    .meeting-signal { width: 72px; height: 72px; margin-bottom: 10px; }
    .signal-core { width: 46px; height: 46px; font-size: 22px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .signal-ring { animation: none; }
  }
</style>
