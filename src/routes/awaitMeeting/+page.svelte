<script lang="ts">
  import { COLORS } from "$lib/consts";
  import { t } from "$lib/i18n";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { onMount } from "svelte";

  $: meetingStatus =
    $lobbyStore?.status.state === "meetingCalled" ? $lobbyStore.status : null;
  $: alivePlayers =
    $lobbyStore == null
      ? []
      : Object.values($lobbyStore.players).filter(
          (player) => !player.isHostOnly && player.status === "alive"
        );
  $: arrivedCount =
    meetingStatus == null
      ? 0
      : alivePlayers.filter((player) => meetingStatus?.presentPlayers[player.color])
          .length;
  $: totalCount = alivePlayers.length;
  $: progress = totalCount === 0 ? 0 : (arrivedCount / totalCount) * 100;

  onMount(() => {
    if ($lobbyStore?.status.state === "meeting") gotoReplace("/vote");

    return lobbyStore.subscribe((lobby) => {
      if (lobby == null || lobby.status.state !== "meeting") return;
      if ($playerStore?.status === "alive") gotoReplace("/vote");
      else gotoReplace("/dead");
    });
  });
</script>

<main class="waiting-page">
  <section class="waiting-card">
    <div class="signal" aria-hidden="true">
      <span class="signal-ring ring-one"></span>
      <span class="signal-ring ring-two"></span>
      <span class="signal-core">
        <span></span><span></span><span></span>
      </span>
    </div>

    <p class="eyebrow">{$t("meeting.waitingEyebrow")}</p>
    <h1>{$t("meeting.waitingTitle")}</h1>
    <p class="description">{$t("meeting.waitingText")}</p>

    <div class="assembly-progress">
      <div class="progress-heading">
        <span>{$t("meeting.waitingProgress")}</span>
        <strong>{arrivedCount}/{totalCount}</strong>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-label={$t("meeting.waitingProgress")}
        aria-valuemin="0"
        aria-valuemax={totalCount}
        aria-valuenow={arrivedCount}
      >
        <span style={`width:${progress}%`}></span>
      </div>
    </div>

    <div class="player-grid">
      {#each alivePlayers as player}
        <div
          class="player-chip"
          class:arrived={meetingStatus?.presentPlayers[player.color] === true}
        >
          <span class={COLORS[player.color] + " player-dot"}></span>
          <span class="player-name">{player.name}</span>
          <span class="player-status">
            {meetingStatus?.presentPlayers[player.color]
              ? $t("meeting.waitingArrived")
              : $t("meeting.waitingOnWay")}
          </span>
        </div>
      {/each}
    </div>
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .waiting-page {
    min-height: var(--app-height);
    width: 100%;
    padding:
      max(20px, var(--safe-top))
      max(16px, var(--safe-right))
      max(20px, var(--safe-bottom))
      max(16px, var(--safe-left));
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at 50% 20%, rgba(34, 197, 94, 0.18), transparent 22rem),
      radial-gradient(circle at 15% 85%, rgba(14, 165, 233, 0.08), transparent 18rem),
      #000;
    color: white;
  }

  .waiting-card {
    width: 100%;
    max-width: 480px;
    padding: clamp(22px, 6vw, 30px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 28px;
    background: rgba(8, 8, 8, 0.93);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.58);
    text-align: center;
  }

  .signal {
    position: relative;
    width: 96px;
    height: 96px;
    margin: 0 auto 18px;
    display: grid;
    place-items: center;
  }

  .signal-ring {
    position: absolute;
    inset: 0;
    border: 1px solid rgba(74, 222, 128, 0.28);
    border-radius: 50%;
    animation: signal-wave 2.4s ease-out infinite;
  }

  .ring-two { animation-delay: 1.2s; }

  .signal-core {
    position: relative;
    z-index: 1;
    width: 58px;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 1px solid rgba(74, 222, 128, 0.4);
    border-radius: 50%;
    background: rgba(20, 83, 45, 0.42);
    box-shadow: 0 0 34px rgba(34, 197, 94, 0.15);
  }

  .signal-core span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #86efac;
    animation: signal-dot 1.1s ease-in-out infinite alternate;
  }

  .signal-core span:nth-child(2) { animation-delay: 0.18s; }
  .signal-core span:nth-child(3) { animation-delay: 0.36s; }

  .eyebrow {
    margin: 0;
    color: #86efac;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    margin: 9px 0 10px;
    font-size: clamp(28px, 8vw, 38px);
    font-weight: 950;
    line-height: 1.05;
    letter-spacing: -0.03em;
  }

  .description {
    max-width: 360px;
    margin: 0 auto;
    color: rgba(255, 255, 255, 0.64);
    font-size: 14px;
    line-height: 1.5;
  }

  .assembly-progress {
    margin-top: 24px;
    padding: 15px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 17px;
    background: rgba(255, 255, 255, 0.045);
    text-align: left;
  }

  .progress-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.64);
  }

  .progress-heading strong {
    color: white;
    font-size: 14px;
  }

  .progress-track {
    height: 7px;
    margin-top: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
  }

  .progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #22c55e, #86efac);
    box-shadow: 0 0 18px rgba(74, 222, 128, 0.32);
    transition: width 320ms ease;
  }

  .player-grid {
    margin-top: 12px;
    display: grid;
    gap: 7px;
  }

  .player-chip {
    min-width: 0;
    padding: 9px 11px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 13px;
    color: rgba(255, 255, 255, 0.5);
    text-align: left;
  }

  .player-chip.arrived {
    border-color: rgba(74, 222, 128, 0.18);
    background: rgba(34, 197, 94, 0.055);
    color: white;
  }

  .player-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    opacity: 0.5;
  }

  .arrived .player-dot {
    opacity: 1;
    box-shadow: 0 0 10px currentColor;
  }

  .player-name {
    min-width: 0;
    overflow: hidden;
    font-size: 13px;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-status {
    color: inherit;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .arrived .player-status { color: #86efac; }

  @keyframes signal-wave {
    0% { transform: scale(0.58); opacity: 0; }
    18% { opacity: 1; }
    100% { transform: scale(1); opacity: 0; }
  }

  @keyframes signal-dot {
    from { transform: translateY(2px); opacity: 0.45; }
    to { transform: translateY(-2px); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .signal-ring,
    .signal-core span { animation: none; }
  }
</style>
