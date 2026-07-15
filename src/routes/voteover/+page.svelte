<script lang="ts">
  import TaskBar from "$lib/TaskBar.svelte";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { COLORS } from "$lib/consts";
  import { gotoReplace } from "$lib/util";
  import type { Color, Vote } from "$lib/types";
  import { t } from "$lib/i18n";

  $: status = $lobbyStore?.status;
  $: taskProgress = $lobbyStore?.taskProgression.displayed ?? 0;

  $: if ($lobbyStore?.status.state === "started") {
    if ($playerStore?.status === "alive") {
      gotoReplace("/game");
    } else {
      gotoReplace("/dead");
    }
  }

  $: if ($lobbyStore?.status.state === "gameEnded") {
    gotoReplace("/gameover");
  }

  function getVoteResults() {
    if ($lobbyStore == null || $lobbyStore.status.state !== "voteResultAnnounced") {
      return [];
    }

    const tally: Record<string, number> = {};

    for (const vote of Object.values($lobbyStore.status.votes)) {
      if (vote === "noVote") continue;

      const key = vote ?? "skip";

      if (tally[key] == null) {
        tally[key] = 1;
      } else {
        tally[key] += 1;
      }
    }

    return Object.entries(tally).sort((a, b) => b[1] - a[1]);
  }

  function getPlayerName(color: string) {
    if (color === "skip") return $t("vote.skipResult");

    const player = $lobbyStore?.players[color as Color];

    return player?.name ?? color;
  }

  function getVotedOutText() {
    if ($lobbyStore == null || $lobbyStore.status.state !== "voteResultAnnounced") {
      return $t("vote.result");
    }

    const votedOutPlayer = $lobbyStore.status.votedOutPlayer;

    if (votedOutPlayer == null) {
      return $t("vote.noneEjected");
    }

    const player = $lobbyStore.players[votedOutPlayer as Color];

    if (player == null) {
      return $t("vote.ejected", { name: votedOutPlayer });
    }

    return $t("vote.ejected", { name: player.name });
  }

  function getVotedOutSubtext() {
    if ($lobbyStore == null || $lobbyStore.status.state !== "voteResultAnnounced") {
      return "";
    }

    const votedOutPlayer = $lobbyStore.status.votedOutPlayer;

    if (votedOutPlayer == null) {
      return $t("vote.tie");
    }

    return $t("vote.ejectedText");
  }
</script>

{#if $lobbyStore != null && $lobbyStore.status.state === "voteResultAnnounced"}
  <main class="voteover-page">
    <section class="voteover-card">
      <p class="eyebrow">{$t("vote.result")}</p>

      <h1>{getVotedOutText()}</h1>

      <p class="description">{getVotedOutSubtext()}</p>

      <div class="task-box">
        <p class="section-title">{$t("vote.progress")}</p>
        <TaskBar {taskProgress} />
      </div>

      <div class="results-box">
        <p class="section-title">{$t("vote.votes")}</p>

        {#if getVoteResults().length === 0}
          <p class="muted">{$t("vote.noVotes")}</p>
        {:else}
          <div class="results-list">
            {#each getVoteResults() as [vote, nVotes]}
              <div class="result-row">
                {#if vote === "skip"}
                  <span class="skip-dot">–</span>
                {:else}
                  <span class={COLORS[vote] + " color-dot"} />
                {/if}

                <span class="result-name">{getPlayerName(vote)}</span>

                <span class="vote-count">
                  {nVotes} {nVotes === 1 ? $t("vote.voteOne") : $t("vote.voteMany")}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="return-box">
        <p>
          {$t("vote.nextRound", { seconds: $lobbyStore.status.countDown })}
        </p>

        {#if $playerStore?.status === "alive"}
          <p class="muted">{$t("vote.returnGame")}</p>
        {:else}
          <p class="muted">{$t("vote.returnGhost")}</p>
        {/if}
      </div>
    </section>
  </main>
{/if}

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .voteover-page {
    min-height: var(--app-height);
    width: 100%;
    padding: 20px;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.14), transparent 30rem),
      #000;
    color: white;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .voteover-card {
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
    margin: 8px 0 14px;
    font-size: 32px;
    line-height: 1.1;
    font-weight: 900;
  }

  .description {
    margin: 0 0 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 15px;
    line-height: 1.45;
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
  .results-box,
  .return-box {
    margin-top: 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
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

  .result-name {
    flex: 1;
    font-weight: 800;
  }

  .vote-count {
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    font-weight: 800;
  }

  .return-box p {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
  }

  .muted {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 14px;
  }

  .return-box .muted {
    margin-top: 6px;
  }
</style>
