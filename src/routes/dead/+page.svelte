<script lang="ts">
  import TaskBar from "$lib/TaskBar.svelte";
  import { COLORS } from "$lib/consts";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { onMount } from "svelte";
  import { language, t } from "$lib/i18n";

  let ghostSignal = 0;
  let signalMessage = "ghost.inactive";
  let pulseInterval: ReturnType<typeof setInterval> | null = null;

  const ghostMessages = [
    "ghost.message1",
    "ghost.message2",
    "ghost.message3",
    "ghost.message4",
    "ghost.message5",
    "ghost.message6",
  ];

  let currentMessage = ghostMessages[0];

  onMount(() => {
    const unsubLobby = lobbyStore.subscribe((lobby) => {
      if (lobby == null) return;

      if (lobby.status.state === "meetingCalled") {
        gotoReplace("/meetingcall");
      } else if (lobby.status.state === "meeting") {
        gotoReplace("/vote");
      } else if (lobby.status.state === "gameEnded") {
        gotoReplace("/gameover");
      }
    });

    const messageInterval = setInterval(() => {
      currentMessage =
        ghostMessages[Math.floor(Math.random() * ghostMessages.length)];
    }, 5000);

    return () => {
      unsubLobby();
      clearInterval(messageInterval);

      if (pulseInterval != null) {
        clearInterval(pulseInterval);
      }
    };
  });

  function startGhostSignal() {
    if (pulseInterval != null) return;

    signalMessage = "ghost.calibrating";

    pulseInterval = setInterval(() => {
      ghostSignal += 5;

      if (ghostSignal >= 100) {
        ghostSignal = 100;
        signalMessage = "ghost.calibrated";

        if (pulseInterval != null) {
          clearInterval(pulseInterval);
          pulseInterval = null;
        }
      }
    }, 250);
  }

  function resetGhostSignal() {
    ghostSignal = 0;
    signalMessage = "ghost.resetMessage";
  }

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
</script>

<main class="dead-page">
  <section class="dead-card">
    <p class="eyebrow">{$t("ghost.eyebrow")}</p>

    <h1>{$t("ghost.title")}</h1>

    <p class="description">
      {$t("ghost.text")}
    </p>

    {#if $lobbyStore != null}
      <div class="task-box">
        <p class="section-title">{$t("ghost.crewGoal")}</p>
        <TaskBar taskProgress={$lobbyStore.taskProgression.displayed} />
      </div>
    {/if}

    <div class="ghost-console">
      <p class="section-title">{$t("ghost.console")}</p>

      <p class="console-text">{$t(signalMessage)}</p>

      <div class="signal-track">
        <div class="signal-fill" style="width: {ghostSignal}%" />
      </div>

      <p class="signal-percent">{ghostSignal}%</p>

      <div class="button-row">
        <button type="button" class="ghost-button" on:click={startGhostSignal}>
          {$t("ghost.calibrate")}
        </button>

        <button type="button" class="ghost-button secondary" on:click={resetGhostSignal}>
          {$t("ghost.reset")}
        </button>
      </div>
    </div>

    <div class="message-box">
      <p class="section-title">{$t("ghost.reminder")}</p>
      <p>{$t(currentMessage)}</p>
    </div>

    {#if $lobbyStore != null}
      <div class="players-grid">
        <div class="players-box">
          <p class="section-title">{$t("ghost.alive")}</p>

          {#if alivePlayers.length === 0}
            <p class="muted">{$t("ghost.noAlive")}</p>
          {:else}
            <ul>
              {#each alivePlayers as player}
                <li>
                  <span class={COLORS[player.color] + " color-dot"} />
                  <span>{player.name}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="players-box">
          <p class="section-title">{$t("ghost.dead")}</p>

          {#if deadPlayers.length === 0}
            <p class="muted">{$t("ghost.noDead")}</p>
          {:else}
            <ul>
              {#each deadPlayers as player}
                <li class="dead-player">
                  <span class={COLORS[player.color] + " color-dot"} />
                  <span>{player.name}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    {/if}

    {#if $playerStore?.tasks?.length}
      <div class="tasks-box">
        <p class="section-title">{$t("ghost.taskHistory")}</p>

        <ul>
          {#each $playerStore.tasks as task}
            <li class:completed={task.status === "completed"}>
              {$language === "en" && task.descriptionEn
                ? task.descriptionEn
                : task.description}
              {#if task.status === "completed"} ✓{/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .dead-page {
    min-height: var(--app-height);
    width: 100%;
    padding: 20px;
    background:
      radial-gradient(circle at top, rgba(148, 163, 184, 0.22), transparent 30rem),
      #000;
    color: white;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .dead-card {
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
    color: rgba(226, 232, 240, 0.65);
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
    color: rgba(255, 255, 255, 0.68);
    font-size: 15px;
    line-height: 1.45;
  }

  .section-title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.8);
  }

  .task-box,
  .ghost-console,
  .message-box,
  .players-box,
  .tasks-box {
    margin-top: 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .ghost-console {
    border-color: rgba(148, 163, 184, 0.25);
    background: rgba(148, 163, 184, 0.08);
  }

  .console-text {
    margin: 0 0 12px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 14px;
  }

  .signal-track {
    height: 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .signal-fill {
    height: 100%;
    border-radius: 999px;
    background: white;
    transition: width 0.2s linear;
  }

  .signal-percent {
    margin: 8px 0 14px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
  }

  .button-row {
    display: flex;
    gap: 10px;
  }

  .ghost-button {
    flex: 1;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.13);
    color: white;
    font-weight: 900;
  }

  .ghost-button.secondary {
    background: rgba(255, 255, 255, 0.06);
  }

  .message-box p:last-child {
    margin: 0;
    color: rgba(255, 255, 255, 0.72);
    font-size: 14px;
    line-height: 1.4;
  }

  .players-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  ul {
    margin: 0;
    padding-left: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    display: inline-block;
    flex: 0 0 auto;
  }

  .dead-player {
    color: rgba(255, 255, 255, 0.46);
    text-decoration: line-through;
  }

  .muted {
    margin: 0;
    color: rgba(255, 255, 255, 0.45);
    font-size: 14px;
  }

  .tasks-box li {
    display: list-item;
    list-style: disc;
    margin-left: 18px;
    line-height: 1.35;
  }

  .tasks-box li.completed {
    color: rgba(255, 255, 255, 0.42);
    text-decoration: line-through;
  }
</style>
