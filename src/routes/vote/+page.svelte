<script lang="ts">
  import TaskBar from "$lib/TaskBar.svelte";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { COLORS } from "$lib/consts";
  import { emitGameAction } from "$lib/websocket";
  import { MEETING_TIME } from "../../../server/consts";
  import type { Color, Vote } from "$lib/types";
  import { gotoReplace } from "$lib/util";
  import { t } from "$lib/i18n";

  let playerPick: Vote | null = null;
  let voted = false;

  $: isMeeting = $lobbyStore?.status.state === "meeting";
  $: isAlive = $playerStore?.status === "alive";
  $: taskProgress = $lobbyStore?.taskProgression.displayed ?? 0;

  $: alivePlayers =
    $lobbyStore == null
      ? []
      : Object.values($lobbyStore.players).filter(
          (player) => player.status === "alive"
        );

  $: deadPlayers =
    $lobbyStore == null
      ? []
      : Object.values($lobbyStore.players).filter(
          (player) => player.status !== "alive"
        );

  $: voters =
    $lobbyStore?.status.state === "meeting"
      ? Object.entries($lobbyStore.status.votes)
          .filter(([, vote]) => vote !== "noVote")
          .map(([color]) => color as Color)
      : [];

  $: voteCount = voters.length;
  $: meetingSeconds =
    $lobbyStore?.status.state === "meeting"
      ? Math.max(0, $lobbyStore.status.countDown)
      : 0;
  $: meetingProgress = Math.min(1, meetingSeconds / MEETING_TIME) * 360;

  $: if ($lobbyStore?.status.state === "voteResultAnnounced") {
    gotoReplace("/voteover");
  }

  function pickPlayerVote(color: Color) {
    handlePlayerPick(color as Vote);
  }

  function handlePlayerPick(vote: Vote) {
    if (voted) return;
    if (!isAlive) return;
    if (!isMeeting) return;

    playerPick = vote;
  }

  async function voteHandler() {
    if (!playerPick) return;
    if (voted) return;
    if (!isAlive) return;
    if (!isMeeting) return;

    voted = true;

    const result = await emitGameAction({
      action: "vote",
      vote: playerPick,
    });

    if (!result.success) voted = false;
  }
</script>

{#if $lobbyStore !== null && $lobbyStore.status.state === "meeting"}
  <main class="vote-page">
    <section class="vote-card">
      <header class="vote-header">
        <div>
          <p class="eyebrow">{$t("meeting.eyebrow")}</p>
          <h1>
            {#if isAlive}
              {$t("vote.pick")}
            {:else}
              {$t("vote.spectator")}
            {/if}
          </h1>
        </div>

        <div
          class="vote-clock"
          class:urgent={meetingSeconds <= 20}
          style={`--vote-progress:${meetingProgress}deg`}
          aria-label={$t("vote.time")}
        >
          <div>
            <strong>{meetingSeconds}</strong>
            <small>sec</small>
          </div>
        </div>
      </header>

      <div class="task-box">
        <TaskBar {taskProgress} />
      </div>

      {#if deadPlayers.length > 0}
        <div class="dead-box">
          <p class="section-title">{$t("vote.dead")}</p>

          <div class="player-list">
            {#each deadPlayers as player}
              <div class="player-row muted">
                <span class={COLORS[player.color] + " color-dot"} />
                <span>
                  {player.name}
                  {#if $lobbyStore.status.caller === player.color}
                    <span class="caller-tag">{$t("vote.caller")}</span>
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if !isAlive}
        <div class="spectator-box">
          <p class="section-title">{$t("vote.ghostRules")}</p>
          <p>
            {$t("vote.ghostText")}
          </p>
        </div>
      {:else}
        <div class="vote-box">
          <p class="section-title">{$t("vote.choose")}</p>

          <div class="choices">
            {#each alivePlayers as player}
              <button
                type="button"
                on:click={() => pickPlayerVote(player.color)}
                class:selected={playerPick === player.color}
                class:voted-button={voters.includes(player.color)}
                disabled={voted}
              >
                <span class={COLORS[player.color] + " color-dot"} />

                <span class="choice-name">
                  {player.name}
                  {#if $lobbyStore.status.caller === player.color}
                    <span class="caller-tag">{$t("vote.caller")}</span>
                  {/if}
                </span>

                {#if voters.includes(player.color)}
                  <span class="voted-tag">{$t("vote.accepted")}</span>
                {/if}

                {#if playerPick === player.color}
                  <span class="selected-mark" aria-hidden="true">✓</span>
                {/if}
              </button>
            {/each}

            <button
              type="button"
              on:click={() => handlePlayerPick("skip")}
              class:selected={playerPick === "skip"}
              disabled={voted}
            >
              <span class="skip-dot">–</span>
              <span class="choice-name">{$t("vote.skip")}</span>
              {#if playerPick === "skip"}
                <span class="selected-mark" aria-hidden="true">✓</span>
              {/if}
            </button>
          </div>
        </div>

        <div class="submit-box">
          <button
            type="button"
            class="submit-button"
            on:click={voteHandler}
            disabled={voted || playerPick == null}
          >
            {#if voted}
              {$t("vote.accepted")}
            {:else}
              {$t("vote.action", { count: voteCount, total: $lobbyStore.status.nVoters })}
            {/if}
          </button>
        </div>
      {/if}
    </section>
  </main>
{/if}

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .vote-page {
    min-height: var(--app-height);
    width: 100%;
    padding:
      max(70px, calc(var(--safe-top) + 58px))
      max(14px, var(--safe-right))
      max(20px, var(--safe-bottom))
      max(14px, var(--safe-left));
    background:
      radial-gradient(circle at 50% 10%, rgba(245, 158, 11, 0.14), transparent 28rem),
      radial-gradient(circle at 12% 78%, rgba(14, 165, 233, 0.06), transparent 20rem),
      #000;
    color: white;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .vote-card {
    width: 100%;
    max-width: 520px;
    padding: clamp(18px, 5vw, 26px);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(10, 9, 7, 0.95);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
  }

  .vote-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 14px;
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
    margin: 8px 0 0;
    font-size: clamp(27px, 8vw, 36px);
    line-height: 1.04;
    font-weight: 950;
    letter-spacing: -0.035em;
  }

  .vote-clock {
    --vote-progress: 360deg;
    width: 68px;
    height: 68px;
    padding: 4px;
    border-radius: 50%;
    background: conic-gradient(#fbbf24 var(--vote-progress), rgba(255, 255, 255, 0.08) 0);
  }

  .vote-clock > div {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: grid;
    place-content: center;
    background: #11100c;
    text-align: center;
  }

  .vote-clock strong { font-size: 23px; font-weight: 950; line-height: 0.9; }
  .vote-clock small { margin-top: 3px; color: rgba(255,255,255,.38); font-size: 7px; font-weight: 900; text-transform: uppercase; }
  .vote-clock.urgent { background: conic-gradient(#f87171 var(--vote-progress), rgba(255,255,255,.08) 0); box-shadow: 0 0 25px rgba(239,68,68,.13); }

  .section-title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.82);
  }

  .task-box,
  .dead-box,
  .spectator-box,
  .vote-box {
    margin-top: 14px;
    padding: 14px;
    border-radius: 17px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .muted {
    color: rgba(255, 255, 255, 0.48);
    text-decoration: line-through;
  }

  .color-dot,
  .skip-dot {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    display: inline-block;
    flex: 0 0 auto;
  }

  .skip-dot {
    background: rgba(255, 255, 255, 0.35);
    text-align: center;
    line-height: 12px;
    font-size: 12px;
  }

  .caller-tag {
    margin-left: 4px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
  }

  .spectator-box {
    border-color: rgba(148, 163, 184, 0.22);
    background: rgba(148, 163, 184, 0.08);
  }

  .spectator-box p:last-child {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.45;
    font-size: 14px;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .choices button {
    width: 100%;
    min-height: 58px;
    padding: 11px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.045);
    color: white;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
  }

  .choices button.selected {
    background: rgba(34, 197, 94, 0.14);
    border-color: rgba(74, 222, 128, 0.7);
    box-shadow: inset 0 0 18px rgba(34, 197, 94, 0.055);
  }

  .choices button:disabled {
    opacity: 0.65;
  }

  .choice-name {
    min-width: 0;
    flex: 1;
    font-size: 12px;
    font-weight: 900;
    overflow-wrap: anywhere;
  }

  .voted-tag {
    width: 7px;
    height: 7px;
    padding: 0;
    border-radius: 50%;
    background: #4ade80;
    color: transparent;
    font-size: 0;
    box-shadow: 0 0 9px rgba(74,222,128,.5);
  }

  .selected-mark { color: #86efac; font-size: 12px; font-weight: 950; }

  .submit-box {
    position: sticky;
    bottom: max(0px, var(--safe-bottom));
    z-index: 2;
    margin-top: 16px;
    padding-top: 8px;
    background: linear-gradient(transparent, rgba(10, 9, 7, 0.96) 30%);
  }

  .submit-button {
    width: 100%;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid rgba(34, 197, 94, 0.65);
    background: rgba(34, 197, 94, 0.16);
    color: white;
    font-size: 17px;
    font-weight: 900;
  }

  .submit-button:disabled {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
  }

  @media (max-width: 350px) {
    .choices { grid-template-columns: minmax(0, 1fr); }
  }
</style>
