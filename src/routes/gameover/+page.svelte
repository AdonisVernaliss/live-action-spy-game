<script lang="ts">
  import TaskBar from "$lib/TaskBar.svelte";
  import MainButton from "$lib/MainButton.svelte";
  import { COLORS } from "$lib/consts";
  import { lobbyStore } from "$lib/stores";
  import type { Player } from "$lib/types";
  import { gotoReplace } from "$lib/util";
  import { onMount } from "svelte";
  import { localizeGameReason, t } from "$lib/i18n";

  let playerOverview: Player[] = [];

  onMount(() => {
    if ($lobbyStore != null) {
      playerOverview = JSON.parse(
        JSON.stringify(Object.values($lobbyStore.players))
      );
    }
  });

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
    gotoReplace("/");
  }

  function getPlayerStatusText(status: string) {
    if (status === "alive") return $t("gameover.alive");
    if (status === "dead") return $t("gameover.dead");
    if (status === "foundDead") return $t("gameover.foundDead");
    return status;
  }

  function getRoleText(roleName: string) {
    if (roleName === "impostor") return $t("role.impostor");
    if (roleName === "crew") return $t("role.crew");
    return roleName;
  }

  function getColorClass(color: string) {
    const colorMap = COLORS as Record<string, string>;
    return (colorMap[color] ?? "bg-gray-500") + " color-dot";
  }

</script>

{#if $lobbyStore != null && $lobbyStore.status.state === "gameEnded"}
  <main class="gameover-page" class:crew-win={victors === "crew"} class:impostor-win={victors === "impostor"}>
    <section class="gameover-card">
      <p class="eyebrow">{$t("gameover.eyebrow")}</p>

      <h1>
        {#if victors === "crew"}
          {$t("gameover.crewWin")}
        {:else}
          {$t("gameover.agentWin")}
        {/if}
      </h1>

      <p class="reason">{localizeGameReason(reason)}</p>

      <div class="task-box">
        <p class="section-title">{$t("gameover.finalProgress")}</p>
        <TaskBar {taskProgress} />
      </div>

      <div class="winner-box">
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

      <div class="players-box">
        <p class="section-title">{$t("gameover.agentTeam")}</p>

        {#if impostors.length === 0}
          <p class="muted">{$t("gameover.noAgents")}</p>
        {:else}
          <div class="player-list">
            {#each impostors as player}
              <div class="player-row impostor-row">
                <span class={getColorClass(player.color)} />
                <div>
                  <p class="player-name">{player.name}</p>
                  <p class="player-meta">
                    {getRoleText(player.role.name)} — {getPlayerStatusText(player.status)}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="players-box">
        <p class="section-title">{$t("gameover.operatives")}</p>

        {#if crew.length === 0}
          <p class="muted">{$t("gameover.noCrew")}</p>
        {:else}
          <div class="player-list">
            {#each crew as player}
              <div class="player-row" class:dead-row={player.status !== "alive"}>
                <span class={getColorClass(player.color)} />
                <div>
                  <p class="player-name">{player.name}</p>
                  <p class="player-meta">
                    {getRoleText(player.role.name)} — {getPlayerStatusText(player.status)}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
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
    padding: 20px;
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
    font-size: 36px;
    line-height: 1.05;
    font-weight: 900;
  }

  .reason {
    margin: 0 0 20px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 16px;
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
  .winner-box,
  .players-box {
    margin-top: 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .winner-text {
    margin: 0;
    color: rgba(255, 255, 255, 0.74);
    font-size: 14px;
    line-height: 1.4;
  }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
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
</style>
