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
    <p class="eyebrow">{$t("meeting.eyebrow")}</p>

    <h1>{$t(meetingCall)}</h1>

    {#if $playerStore?.status === "alive"}
      <p class="description">
        {$t("meeting.go")}
      </p>

      <div class="scan-box">
        <p class="scan-title">{$t("meeting.nfc")}</p>
        <p class="scan-text">
          {$t("meeting.nfcHint")}
        </p>

        <ScanButton on:scanned={({ detail }) => handleScan(detail.result)} />
      </div>

      <div class="fallback-box">
        <p class="fallback-title">{$t("meeting.noNfc")}</p>
        <p class="fallback-text">
          {$t("meeting.noNfcHint")}
        </p>

        <MainButton on:click={enterMeeting}>
          {$t("meeting.arrived")}
        </MainButton>
      </div>
    {:else}
      <div class="fallback-box">
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
    padding: 20px;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 28rem),
      #000;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .meeting-card {
    width: 100%;
    max-width: 460px;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(8, 8, 8, 0.94);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
  }

  .eyebrow {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 8px 0 14px;
    font-size: 28px;
    line-height: 1.12;
    font-weight: 900;
  }

  .description {
    margin: 0 0 22px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 15px;
    line-height: 1.45;
  }

  .scan-box,
  .fallback-box {
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .fallback-box {
    margin-top: 16px;
    border-color: rgba(34, 197, 94, 0.25);
    background: rgba(34, 197, 94, 0.08);
  }

  .scan-title,
  .fallback-title {
    margin: 0;
    font-size: 15px;
    font-weight: 900;
  }

  .scan-text,
  .fallback-text {
    margin: 6px 0 14px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 1.4;
  }
</style>
