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

  $: voteResults = getVoteResults();
  $: maxVotes = Math.max(1, ...voteResults.map(([, count]) => count));
</script>

{#if $lobbyStore != null && $lobbyStore.status.state === "voteResultAnnounced"}
  <main class="voteover-page">
    <section class="voteover-card">
      <header class="result-hero">
        <div class="result-symbol" aria-hidden="true">
          {$lobbyStore.status.votedOutPlayer == null ? "=" : "↓"}
        </div>
        <div>
          <p class="eyebrow">{$t("vote.result")}</p>
          <h1>{getVotedOutText()}</h1>
          <p class="description">{getVotedOutSubtext()}</p>
        </div>
      </header>

      <div class="task-box">
        <p class="section-title">{$t("vote.progress")}</p>
        <TaskBar {taskProgress} />
      </div>

      <div class="results-box">
        <p class="section-title">{$t("vote.votes")}</p>

        {#if voteResults.length === 0}
          <p class="muted">{$t("vote.noVotes")}</p>
        {:else}
          <div class="results-list">
            {#each voteResults as [vote, nVotes]}
              <div class="result-row">
                <div class="result-heading">
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
                <div class="vote-bar" aria-hidden="true">
                  <span style={`width:${(nVotes / maxVotes) * 100}%`}></span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="return-box">
        <div class="return-countdown">{$lobbyStore.status.countDown}</div>
        <div>
          <p>{$t("vote.nextRound", { seconds: $lobbyStore.status.countDown })}</p>

          {#if $playerStore?.status === "alive"}
            <p class="muted">{$t("vote.returnGame")}</p>
          {:else}
            <p class="muted">{$t("vote.returnGhost")}</p>
          {/if}
        </div>
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
    padding:
      max(70px, calc(var(--safe-top) + 58px))
      max(14px, var(--safe-right))
      max(20px, var(--safe-bottom))
      max(14px, var(--safe-left));
    background:
      radial-gradient(circle at 50% 10%, rgba(56, 189, 248, 0.12), transparent 28rem),
      #000;
    color: white;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .voteover-card {
    width: 100%;
    max-width: 520px;
    padding: clamp(18px, 5vw, 26px);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(6, 10, 14, 0.95);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
  }

  .result-hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: 14px;
  }

  .result-symbol {
    width: 54px;
    height: 54px;
    border: 1px solid rgba(125, 211, 252, 0.3);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(14, 116, 144, 0.11);
    color: #7dd3fc;
    font-size: 25px;
    font-weight: 950;
    box-shadow: 0 0 24px rgba(56, 189, 248, 0.08);
  }

  .eyebrow {
    margin: 0;
    color: #7dd3fc;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h1 {
    margin: 6px 0 7px;
    font-size: clamp(25px, 7vw, 35px);
    line-height: 1.05;
    font-weight: 950;
    letter-spacing: -0.035em;
  }

  .description {
    margin: 0;
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
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
    margin-top: 14px;
    padding: 14px;
    border-radius: 17px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .result-row {
    display: grid;
    gap: 7px;
  }

  .result-heading {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
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

  .vote-bar {
    height: 5px;
    margin-left: 23px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
  }

  .vote-bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #0e7490, #38bdf8, #bae6fd);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
    transition: width 300ms ease;
  }

  .return-box p {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
  }

  .return-box {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }

  .return-countdown {
    width: 42px;
    height: 42px;
    border: 1px solid rgba(125, 211, 252, 0.26);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(14, 116, 144, 0.08);
    color: white;
    font-size: 17px;
    font-weight: 950;
  }

  .muted {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 14px;
  }

  .return-box .muted {
    margin-top: 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    .vote-bar span { transition: none; }
  }
</style>
