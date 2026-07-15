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
      <p class="eyebrow">{$t("meeting.eyebrow")}</p>

      <h1>
        {#if isAlive}
          {$t("vote.pick")}
        {:else}
          {$t("vote.spectator")}
        {/if}
      </h1>

      <div class="task-box">
        <p class="section-title">{$t("vote.progress")}</p>
        <TaskBar {taskProgress} />
      </div>

      <div class="timer-box">
        <div class="timer-header">
          <span>{$t("vote.time")}</span>
          <strong>{$lobbyStore.status.countDown}s</strong>
        </div>

        <progress
          value={$lobbyStore.status.countDown}
          max={MEETING_TIME}
          class="vote-progress"
        />
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
    padding: 20px;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 30rem),
      #000;
    color: white;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .vote-card {
    width: 100%;
    max-width: 520px;
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
    margin: 8px 0 18px;
    font-size: 32px;
    line-height: 1.1;
    font-weight: 900;
  }

  .section-title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.82);
  }

  .task-box,
  .timer-box,
  .dead-box,
  .spectator-box,
  .vote-box {
    margin-top: 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .timer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 14px;
  }

  .vote-progress {
    width: 100%;
    height: 14px;
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
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .choices button {
    width: 100%;
    min-height: 54px;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(34, 197, 94, 0.45);
    background: rgba(255, 255, 255, 0.06);
    color: white;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
  }

  .choices button.selected {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.9);
  }

  .choices button:disabled {
    opacity: 0.65;
  }

  .choice-name {
    flex: 1;
    font-weight: 800;
  }

  .voted-tag {
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.18);
    color: #86efac;
    font-size: 12px;
    font-weight: 900;
  }

  .submit-box {
    margin-top: 20px;
  }

  .submit-button {
    width: 100%;
    padding: 16px;
    border-radius: 18px;
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
</style>
