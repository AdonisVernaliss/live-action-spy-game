<script lang="ts">
  import TaskBar from "$lib/TaskBar.svelte";
  import MainButton from "$lib/MainButton.svelte";
  import { COLORS } from "$lib/consts";
  import { lobbyStore } from "$lib/stores";
  import type { Player } from "$lib/types";
  import { gotoReplace } from "$lib/util";
  import { localizeGameReason, t } from "$lib/i18n";

  let playerOverview: Player[] = [];

  $: if (
    playerOverview.length === 0 &&
    $lobbyStore?.status.state === "gameEnded"
  ) {
    playerOverview = JSON.parse(
      JSON.stringify(Object.values($lobbyStore.players))
    );
  }

  $: victors =
    $lobbyStore?.status.state === "gameEnded"
      ? $lobbyStore.status.victors
      : null;

  $: reason =
    $lobbyStore?.status.state === "gameEnded"
      ? $lobbyStore.status.reason
      : "";

  $: taskProgress = $lobbyStore?.taskProgression.displayed ?? 0;

  $: impostors = playerOverview.filter(
    (player) => player.role.name === "impostor"
  );

  $: crew = playerOverview.filter(
    (player) => player.role.name === "crew"
  );

  function leaveGame() {
    localStorage.removeItem("gameInfo");
    localStorage.removeItem("currentTaskNumber");
    localStorage.removeItem("currentTaskTag");
    gotoReplace("/");
  }

  function getPlayerStatusText(status: string) {
    if (status === "alive") return $t("gameover.alive");
    if (status === "dead") return $t("gameover.dead");
    if (status === "foundDead") return $t("gameover.foundDead");
    return status;
  }

  function getColorClass(color: string) {
    const colorMap = COLORS as Record<string, string>;
    return (colorMap[color] ?? "bg-gray-500") + " color-dot";
  }
</script>

{#if $lobbyStore != null && $lobbyStore.status.state === "gameEnded"}
  <main class="gameover-page" class:crew-win={victors === "crew"} class:impostor-win={victors === "impostor"}>
    <section class="gameover-card">
      <header class="victory-hero">
        <div class="victory-emblem" aria-hidden="true">
          <span>{victors === "crew" ? "O" : "A"}</span>
          <i></i>
        </div>

        <p class="eyebrow">{$t("gameover.eyebrow")}</p>
        <h1>
          {#if victors === "crew"}
            {$t("gameover.crewWin")}
          {:else}
            {$t("gameover.agentWin")}
          {/if}
        </h1>

        <p class="reason">{localizeGameReason(reason)}</p>
      </header>

      <div class="mission-summary">
        <div>
          <p class="section-title">
            {#if victors === "crew"}
              {$t("gameover.crewTeam")}
            {:else}
              {$t("gameover.agentTeam")}
            {/if}
          </p>

          {#if victors === "crew"}
            <p class="winner-text">{$t("gameover.crewText")}</p>
          {:else}
            <p class="winner-text">{$t("gameover.agentText")}</p>
          {/if}
        </div>
        <div class="task-box">
          <TaskBar {taskProgress} />
        </div>
      </div>

      <div class="roster-grid">
        <section class="players-box agents">
          <div class="roster-heading">
            <p class="section-title">{$t("gameover.agentTeam")}</p>
            <span>{impostors.length}</span>
          </div>

          {#if impostors.length === 0}
            <p class="muted">{$t("gameover.noAgents")}</p>
          {:else}
            <div class="player-list">
              {#each impostors as player}
                <div class="player-row impostor-row">
                  <span class={getColorClass(player.color)} />
                  <div>
                    <p class="player-name">{player.name}</p>
                    <p class="player-meta">{getPlayerStatusText(player.status)}</p>
                  </div>
                  <span class="role-tag">A</span>
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <section class="players-box operatives">
          <div class="roster-heading">
            <p class="section-title">{$t("gameover.operatives")}</p>
            <span>{crew.length}</span>
          </div>

          {#if crew.length === 0}
            <p class="muted">{$t("gameover.noCrew")}</p>
          {:else}
            <div class="player-list">
              {#each crew as player}
                <div class="player-row" class:dead-row={player.status !== "alive"}>
                  <span class={getColorClass(player.color)} />
                  <div>
                    <p class="player-name">{player.name}</p>
                    <p class="player-meta">{getPlayerStatusText(player.status)}</p>
                  </div>
                  <span class="role-tag">O</span>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </div>

      <div class="actions">
        <MainButton on:click={leaveGame}>{$t("gameover.leave")}</MainButton>
      </div>
    </section>
  </main>
{/if}

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .gameover-page {
    min-height: var(--app-height);
    width: 100%;
    padding:
      max(70px, calc(var(--safe-top) + 58px))
      max(14px, var(--safe-right))
      max(20px, var(--safe-bottom))
      max(14px, var(--safe-left));
    color: white;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    background: #000;
  }

  .gameover-page.crew-win {
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.18), transparent 30rem),
      #000;
  }

  .gameover-page.impostor-win {
    background:
      radial-gradient(circle at top, rgba(239, 68, 68, 0.2), transparent 30rem),
      #000;
  }

  .gameover-card {
    width: 100%;
    max-width: 540px;
    padding: clamp(18px, 5vw, 28px);
    border-radius: 30px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(7, 9, 8, 0.95);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
  }

  .victory-hero { text-align: center; }

  .victory-emblem {
    position: relative;
    width: 102px;
    height: 102px;
    margin: 2px auto 16px;
    border: 1px solid rgba(74, 222, 128, 0.34);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: radial-gradient(circle, rgba(34, 197, 94, 0.2), rgba(20, 83, 45, 0.04) 62%, transparent 64%);
    box-shadow: 0 0 42px rgba(34, 197, 94, 0.13);
  }

  .impostor-win .victory-emblem {
    border-color: rgba(248, 113, 113, 0.38);
    background: radial-gradient(circle, rgba(239, 68, 68, 0.22), rgba(127, 29, 29, 0.04) 62%, transparent 64%);
    box-shadow: 0 0 42px rgba(239, 68, 68, 0.15);
  }

  .victory-emblem::before {
    content: "";
    position: absolute;
    inset: -8px;
    border: 1px solid transparent;
    border-right-color: rgba(134, 239, 172, 0.33);
    border-left-color: rgba(134, 239, 172, 0.18);
    border-radius: 50%;
  }

  .impostor-win .victory-emblem::before { border-right-color: rgba(252,165,165,.34); border-left-color: rgba(252,165,165,.18); }
  .victory-emblem span { font-size: 38px; font-weight: 950; }
  .victory-emblem i { position: absolute; bottom: 13px; width: 24px; height: 3px; border-radius: 99px; background: #4ade80; box-shadow: 0 0 12px rgba(74,222,128,.6); }
  .impostor-win .victory-emblem i { background: #f87171; box-shadow: 0 0 12px rgba(248,113,113,.6); }

  .eyebrow {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.17em;
    text-transform: uppercase;
  }

  h1 {
    margin: 8px 0 10px;
    font-size: clamp(32px, 9vw, 45px);
    line-height: 1.02;
    font-weight: 950;
    letter-spacing: -0.045em;
  }

  .reason {
    max-width: 420px;
    margin: 0 auto;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
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

  .mission-summary,
  .players-box {
    margin-top: 14px;
    padding: 14px;
    border-radius: 17px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .mission-summary {
    display: grid;
    gap: 13px;
    border-color: rgba(74, 222, 128, 0.15);
    background: rgba(34, 197, 94, 0.045);
  }

  .impostor-win .mission-summary {
    border-color: rgba(248, 113, 113, 0.15);
    background: rgba(239, 68, 68, 0.045);
  }

  .task-box { padding-top: 12px; border-top: 1px solid rgba(255,255,255,.08); }

  .winner-text {
    margin: 0;
    color: rgba(255, 255, 255, 0.74);
    font-size: 14px;
    line-height: 1.4;
  }

  .roster-grid { display: grid; gap: 0; }

  .roster-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .roster-heading .section-title { margin: 0; }
  .roster-heading > span { min-width: 26px; height: 23px; padding: 0 7px; border: 1px solid rgba(255,255,255,.1); border-radius: 99px; display: grid; place-items: center; color: rgba(255,255,255,.65); font-size: 10px; font-weight: 950; }
  .agents { border-color: rgba(248,113,113,.14); background: rgba(239,68,68,.035); }
  .operatives { border-color: rgba(74,222,128,.13); background: rgba(34,197,94,.035); }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 12px;
    background: rgba(0,0,0,.16);
  }

  .impostor-row .player-name {
    color: #fca5a5;
  }

  .dead-row {
    opacity: 0.55;
  }

  .color-dot {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    display: inline-block;
    flex: 0 0 auto;
  }

  .player-name {
    margin: 0;
    font-size: 15px;
    font-weight: 900;
  }

  .player-row > div { min-width: 0; flex: 1; }
  .role-tag { color: rgba(255,255,255,.24); font-size: 10px; font-weight: 950; }

  .player-meta {
    margin: 3px 0 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 13px;
  }

  .muted {
    margin: 0;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .actions {
    margin-top: 22px;
    display: flex;
    justify-content: center;
  }

  @media (min-width: 520px) {
    .roster-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  }
</style>
