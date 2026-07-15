<script lang="ts">
  import MainButton from "$lib/MainButton.svelte";
  import Title from "$lib/Title.svelte";
  import QrCode from "$lib/QrCode.svelte";
  import { onMount } from "svelte";
  import { actionErrorStore, lobbyStore, playerStore } from "$lib/stores";
  import type { Socket } from "socket.io-client";
  import {
    COLORS,
    MINIMUM_N_PLAYERS,
    TEST_MODE_MIN_PLAYERS,
  } from "$lib/consts";
  import { dev } from "$lib/consts";
  import { emitGameAction, getSocketIO } from "$lib/websocket";
  import { gotoReplace } from "$lib/util";
  import { t } from "$lib/i18n";
  import type { Player } from "$lib/types";

  const N_PAGES = 4;

  let socket: Socket;
  let roomLink = "";
  let infoPage = 0;
  let copied = false;

  onMount(() => {
    socket = getSocketIO();
    if ($lobbyStore != null) roomLink = getRoomLink();

    const redirectTimer = setTimeout(() => {
      if ($lobbyStore == null) gotoReplace("/");
    }, 1800);

    return () => clearTimeout(redirectTimer);
  });

  let touchStartX = 0;
  let touchStartY = 0;
  let swipeAllowed = false;
  let swipeInput: "pointer" | "touch" | null = null;

  function beginSwipe(
    clientX: number,
    clientY: number,
    target: EventTarget | null,
    input: "pointer" | "touch"
  ) {
    const element = target as Element | null;
    swipeAllowed = !element?.closest("button, a, input, select, textarea, canvas");
    if (!swipeAllowed) return;

    swipeInput = input;
    touchStartX = clientX;
    touchStartY = clientY;
  }

  function finishSwipe(
    clientX: number,
    clientY: number,
    input: "pointer" | "touch"
  ) {
    if (!swipeAllowed || swipeInput !== input) return;
    swipeAllowed = false;
    swipeInput = null;

    const deltaX = clientX - touchStartX;
    const deltaY = clientY - touchStartY;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Only treat the gesture as a page swipe if it is clearly horizontal.
    // Vertical movement remains normal page scrolling.
    if (absX < 56 || absX < absY * 1.15) return;

    changeInfoPage(deltaX < 0 ? 1 : -1);
  }

  function handlePointerStart(event: PointerEvent) {
    if (!event.isPrimary) return;
    beginSwipe(event.clientX, event.clientY, event.target, "pointer");
  }

  function handlePointerEnd(event: PointerEvent) {
    if (!event.isPrimary) return;
    finishSwipe(event.clientX, event.clientY, "pointer");
  }

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (touch) beginSwipe(touch.clientX, touch.clientY, event.target, "touch");
  }

  function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (touch) finishSwipe(touch.clientX, touch.clientY, "touch");
  }

  function changeInfoPage(delta: number) {
    infoPage = Math.max(0, Math.min(infoPage + delta, N_PAGES - 1));
  }

  function cancelSwipe() {
    swipeAllowed = false;
    swipeInput = null;
  }

  function getRoomLink(): string {
    if ($lobbyStore == null) return "";

    return (
      window.location.origin +
      `/join?code=${$lobbyStore.id}&creator=${encodeURIComponent(
        $lobbyStore.creator
      )}`
    );
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(roomLink);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1600);
    } catch {
      copied = false;
    }
  }

  function startGame() {
    const io = getSocketIO();

    console.log("START GAME CLICKED", {
      socketConnected: io.connected,
      lobbyId: $lobbyStore?.id,
      lobbyState: $lobbyStore?.status.state,
      creator: $lobbyStore?.creator,
      player: $playerStore?.name,
      playerColor: $playerStore?.color,
      playerIsCreator,
      dev,
      enoughPlayers,
      allPlayersReady,
      readyCount,
      playerCount,
      canStartGame,
    });

    io.emit(
      "startGame",
      ({ success, message }: { success: boolean; message?: string }) => {
        if (!success) actionErrorStore.set(message || "Не удалось начать игру.");
      }
    );
  }

  function setReady() {
    emitGameAction({ action: "playerReady" });
  }

  function isPlayerReady(player: Player): boolean {
    if ($lobbyStore?.status.state !== "inLobby") return false;

    // The creator confirms their own readiness by starting the game.
    return (
      player.name === $lobbyStore.creator ||
      $lobbyStore.status.readyPlayers[player.color] === true
    );
  }

  $: allLobbyPlayers = Object.values($lobbyStore?.players || {});
  $: players = allLobbyPlayers.filter((player) => !player.isHostOnly);
  $: hostPlayer = allLobbyPlayers.find((player) => player.isHostOnly);
  $: playerCount = players.length;
  $: maximumPlayerCount = hostPlayer == null ? 15 : 14;

  $: if ($lobbyStore != null && typeof window !== "undefined") {
    roomLink = getRoomLink();
  }

  $: testModeEnabled = $lobbyStore?.testMode?.enabled === true;

  $: minimumRequired = testModeEnabled
    ? TEST_MODE_MIN_PLAYERS
    : MINIMUM_N_PLAYERS;

  $: enoughPlayers = playerCount >= minimumRequired;

  $: playerIsCreator = $lobbyStore?.creator === $playerStore?.name;
  $: playerIsHostOnly = $playerStore?.isHostOnly === true;

  $: readyCount =
    $lobbyStore?.status.state === "inLobby"
      ? players.filter(isPlayerReady).length
      : 0;

  $: currentPlayerReady =
    $lobbyStore?.status.state === "inLobby" &&
    $playerStore != null &&
    isPlayerReady($playerStore);

  $: allPlayersReady =
    enoughPlayers && (testModeEnabled || readyCount >= playerCount);

  $: canStartGame =
    playerIsCreator && (dev || (enoughPlayers && allPlayersReady));

  $: if ($lobbyStore?.status.state === "roleExplanation") {
    gotoReplace(playerIsHostOnly ? "/admin" : "/role");
  }

  $: if ($lobbyStore?.status.state === "started") {
    if (playerIsHostOnly) {
      gotoReplace("/admin");
    } else if ($playerStore?.status === "alive") {
      gotoReplace("/game");
    } else if ($playerStore?.status === "dead") {
      gotoReplace("/killed");
    } else {
      gotoReplace("/dead");
    }
  }

  $: if ($lobbyStore?.status.state === "gameEnded") {
    gotoReplace(playerIsHostOnly ? "/admin" : "/gameover");
  }

</script>

{#if $lobbyStore != null && $lobbyStore.status.state === "settingRooms"}
  <main class="setup-wait-page">
    <section class="setup-wait-card">
      <div class="wait-pulse" aria-hidden="true"></div>
      <p class="eyebrow">{$t("lobby.preparation")}</p>
      <h1>{$t("lobby.hostConfiguring")}</h1>
      <p>
        {$t("lobby.hostConfiguringText", { creator: $lobbyStore.creator })}
      </p>
      <div class="wait-player">
        <span>{$t("lobby.connectedAs")}</span>
        <strong>{$playerStore?.name}</strong>
      </div>
    </section>
  </main>
{:else if $lobbyStore != null && $lobbyStore.status.state === "inLobby"}
  <main class="lobby-page">
    <div
      class="swipe-area"
      on:pointerdown={handlePointerStart}
      on:pointerup={handlePointerEnd}
      on:pointercancel={cancelSwipe}
      on:touchstart={handleTouchStart}
      on:touchend={handleTouchEnd}
      on:touchcancel={cancelSwipe}
    >
      {#if infoPage === 0}
        <section class="lobby-card">
          <div class="title-wrap">
            <Title />
          </div>

          <div class="lobby-header">
            <div>
              <p class="eyebrow">{$t("lobby.eyebrow")}</p>
              <h1>{$t("lobby.waitingRoom")}</h1>
            </div>

            <div class="counter-card">
              <span>{playerCount}</span>
              <small>/ {maximumPlayerCount}</small>
            </div>
          </div>

          <div class="invite-section">
            <p class="section-title">{$t("lobby.invitation")}</p>

            <button type="button" class="copy-link-button" on:click={copyInviteLink}>
              {#if copied}
                {$t("lobby.copied")}
              {:else}
                {$t("lobby.copy")}
              {/if}
            </button>

            <p class="room-code">
              {$t("lobby.code")} <strong>{$lobbyStore.id}</strong>
            </p>

            <div class="qr-wrap">
              {#if roomLink}
                {#key roomLink}
                  <QrCode link={roomLink} />
                {/key}
              {:else}
                <div class="qr-placeholder">{$t("lobby.qrLoading")}</div>
              {/if}
            </div>

            <p class="hint-text">
              {$t("lobby.qrHint")}
            </p>
          </div>

          <div class="players-section">
            <div class="players-header">
              <div>
                <p class="section-title">{$t("common.players")}</p>
                <h2>{$t("lobby.connectedCount", { count: playerCount })}</h2>
              </div>

              <div class="ready-badge">
                {#if testModeEnabled}
                  {$t("lobby.testTimers")}
                {:else}
                  {$t("lobby.readyCount", { ready: readyCount, total: playerCount })}
                {/if}
              </div>
            </div>

            {#if hostPlayer}
              <div class="host-only-card">
                <div class="player-left">
                  <div class={COLORS[hostPlayer.color] + " color-dot"}></div>
                  <div class="player-text">
                    <div class="player-name">{hostPlayer.name}</div>
                    <div class="player-subtext">
                      {$t("lobby.hostOnly", {
                        connection: hostPlayer.connection === "connected"
                          ? $t("lobby.online")
                          : $t("lobby.offline"),
                      })}
                    </div>
                  </div>
                </div>
                <span>{$t("lobby.control")}</span>
              </div>
            {/if}

            <div class="players-grid">
              {#each players as player}
                <div class="player-card">
                  <div class="player-left">
                    <div class={COLORS[player.color] + " color-dot"}></div>

                    <div class="player-text">
                      <div class="player-name">
                        {player.name}
                        {#if player.name === $lobbyStore.creator}
                          <span class="host-badge">{$t("common.host")}</span>
                        {/if}
                      </div>

                      <div class="player-subtext">
                        {#if player.connection === "simulated"}
                          {$t("lobby.simulation")}
                        {:else if player.connection === "connected"}
                          {$t("common.connected")}
                        {:else}
                          {$t("common.disconnected")}
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div
                    class:ready-check={isPlayerReady(player)}
                    class:not-ready-check={!isPlayerReady(player)}
                  >
                    ✓
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </section>
      {:else if infoPage === 1}
        <section class="tutorial-card">
          <p class="eyebrow">{$t("rules.crew.eyebrow")}</p>
          <h1>{$t("rules.crew.title")}</h1>

          <div class="tutorial-list">
            <div class="tutorial-item">
              <span>01</span>
              <div>
                <h2>{$t("rules.crew.taskTitle")}</h2>
                <p>{$t("rules.crew.taskText")}</p>
              </div>
            </div>

            <div class="tutorial-item">
              <span>02</span>
              <div>
                <h2>{$t("rules.crew.progressTitle")}</h2>
                <p>{$t("rules.crew.progressText")}</p>
              </div>
            </div>

            <div class="tutorial-item">
              <span>03</span>
              <div>
                <h2>{$t("rules.crew.bodyTitle")}</h2>
                <p>{$t("rules.crew.bodyText")}</p>
              </div>
            </div>

            <div class="tutorial-item">
              <span>04</span>
              <div>
                <h2>{$t("rules.crew.sabotageTitle")}</h2>
                <p>{$t("rules.crew.sabotageText")}</p>
              </div>
            </div>
          </div>
        </section>
      {:else if infoPage === 2}
        <section class="tutorial-card">
          <p class="eyebrow">{$t("rules.agent.eyebrow")}</p>
          <h1>{$t("rules.agent.title")}</h1>

          <div class="tutorial-list">
            <div class="tutorial-item danger">
              <span>01</span>
              <div>
                <h2>{$t("rules.agent.killTitle")}</h2>
                <p>{$t("rules.agent.killText")}</p>
              </div>
            </div>

            <div class="tutorial-item danger">
              <span>02</span>
              <div>
                <h2>{$t("rules.agent.sabotageTitle")}</h2>
                <p>{$t("rules.agent.sabotageText")}</p>
              </div>
            </div>

            <div class="tutorial-item danger">
              <span>03</span>
              <div>
                <h2>{$t("rules.agent.virusTitle")}</h2>
                <p>{$t("rules.agent.virusText")}</p>
              </div>
            </div>

            <div class="tutorial-item danger">
              <span>04</span>
              <div>
                <h2>{$t("rules.agent.blendTitle")}</h2>
                <p>{$t("rules.agent.blendText")}</p>
              </div>
            </div>
          </div>
        </section>
      {:else if infoPage === 3}
        <section class="tutorial-card">
          <p class="eyebrow">{$t("rules.meeting.eyebrow")}</p>
          <h1>{$t("rules.meeting.title")}</h1>

          <div class="tutorial-list">
            <div class="tutorial-item">
              <span>01</span>
              <div>
                <h2>{$t("rules.meeting.meetingTitle")}</h2>
                <p>{$t("rules.meeting.meetingText")}</p>
              </div>
            </div>

            <div class="tutorial-item">
              <span>02</span>
              <div>
                <h2>{$t("rules.meeting.voteTitle")}</h2>
                <p>{$t("rules.meeting.voteText")}</p>
              </div>
            </div>

            <div class="tutorial-item">
              <span>03</span>
              <div>
                <h2>{$t("rules.meeting.ghostTitle")}</h2>
                <p>{$t("rules.meeting.ghostText")}</p>
              </div>
            </div>

            <div class="tutorial-item">
              <span>04</span>
              <div>
                <h2>{$t("rules.meeting.secretTitle")}</h2>
                <p>{$t("rules.meeting.secretText")}</p>
              </div>
            </div>
          </div>
        </section>
      {/if}
    </div>

    <section class="bottom-panel">
      <span class="swipe-text">{$t("lobby.rulesSwipe")}</span>

      <div class="page-navigation">
        <button
          type="button"
          class="page-arrow"
          disabled={infoPage === 0}
          on:click={() => changeInfoPage(-1)}
          aria-label={$t("lobby.previousPage")}
        >‹</button>

        <div class="page-dots">
          {#each Array(N_PAGES) as _, idx}
            <button
              type="button"
              class="dot"
              class:active-dot={idx === infoPage}
              class:inactive-dot={idx !== infoPage}
              on:click={() => (infoPage = idx)}
              aria-label={$t("lobby.pageAria", { page: idx + 1 })}
            ></button>
          {/each}
        </div>

        <button
          type="button"
          class="page-arrow"
          disabled={infoPage === N_PAGES - 1}
          on:click={() => changeInfoPage(1)}
          aria-label={$t("lobby.nextPage")}
        >›</button>
      </div>

      {#if playerIsCreator}
        <button
          type="button"
          class="host-panel-button"
          on:click={() => gotoReplace("/admin")}
        >
          {$t("lobby.openHost")}
        </button>

        <MainButton on:click={startGame}>
          {testModeEnabled ? $t("lobby.startTest") : $t("lobby.start")}
        </MainButton>

        {#if playerIsHostOnly}
          <p class="host-only-note">
            {$t("lobby.hostOnlyNote")}
          </p>
        {/if}

        {#if !canStartGame}
          <p class="start-debug">
            {$t("lobby.devStatus", {
              dev: dev ? $t("lobby.on") : $t("lobby.off"),
              ready: readyCount,
              total: playerCount,
            })}
          </p>
        {/if}
      {:else if !enoughPlayers}
        <MainButton disabled>
          <span class="text-sm">
            {$t("lobby.waitPlayers", { count: playerCount, minimum: minimumRequired })}
          </span>
        </MainButton>
      {:else if !currentPlayerReady}
        <MainButton on:click={setReady}>{$t("lobby.readyAction")}</MainButton>
      {:else if !allPlayersReady}
        <MainButton disabled>{$t("lobby.waitOthers")}</MainButton>
      {:else}
        <MainButton disabled>
          <span class="text-sm">{$t("lobby.waitHost")}</span>
        </MainButton>
      {/if}
    </section>
  </main>
{/if}

<style>
  :global(html),
  :global(body) {
    background: #000;
    overflow-x: hidden;
  }

  .start-debug {
    margin-top: 8px;
    text-align: center;
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
  }

  .setup-wait-page {
    width: 100%;
    min-height: var(--app-height);
    padding:
      max(var(--page-gutter), var(--safe-top))
      max(var(--page-gutter), var(--safe-right))
      max(var(--page-gutter), var(--safe-bottom))
      max(var(--page-gutter), var(--safe-left));
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 28rem),
      #000;
  }

  .setup-wait-card {
    width: min(480px, 100%);
    padding: clamp(22px, 6vw, 38px);
    border: 1px solid rgba(34, 197, 94, 0.24);
    border-radius: 24px;
    background: rgba(8, 8, 8, 0.96);
    text-align: center;
    box-shadow: 0 20px 80px rgba(0, 0, 0, 0.55);
  }

  .setup-wait-card h1 {
    margin: 9px 0 13px;
    font-size: clamp(25px, 7vw, 38px);
    line-height: 1.08;
    font-weight: 950;
  }

  .setup-wait-card > p:not(.eyebrow) {
    margin: 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 14px;
    line-height: 1.5;
  }

  .wait-pulse {
    width: 54px;
    height: 54px;
    margin: 0 auto 18px;
    border: 2px solid rgba(74, 222, 128, 0.3);
    border-top-color: #4ade80;
    border-radius: 50%;
    animation: wait-spin 1.1s linear infinite;
  }

  .wait-player {
    margin-top: 22px;
    padding: 13px;
    display: grid;
    gap: 4px;
    border-radius: 14px;
    background: rgba(34, 197, 94, 0.08);
  }

  .wait-player span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
    text-transform: uppercase;
  }

  .wait-player strong {
    color: #86efac;
    overflow-wrap: anywhere;
  }

  @keyframes wait-spin {
    to { transform: rotate(360deg); }
  }

  .qr-placeholder {
    width: 180px;
    height: 180px;
    border-radius: 16px;
    border: 1px dashed rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: rgba(255, 255, 255, 0.55);
    font-size: 13px;
    padding: 16px;
  }

  .lobby-page {
    min-height: 100vh;
    width: 100%;
    padding: 14px;
    padding-bottom: 22px;
    overflow-x: hidden;
    overflow-y: auto;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 28rem),
      #000;
    color: white;
  }

  .swipe-area {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    touch-action: pan-y;
    -ms-touch-action: pan-y;
  }

  .lobby-card,
  .tutorial-card {
    width: 100%;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(8, 8, 8, 0.94);
    box-shadow: 0 18px 70px rgba(0, 0, 0, 0.5);
  }

  .lobby-card {
    padding: 16px;
  }

  .tutorial-card {
    padding: 20px;
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .title-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
    transform: scale(0.82);
    transform-origin: center;
  }

  .lobby-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .eyebrow,
  .section-title {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .lobby-header h1 {
    margin: 4px 0 0;
    font-size: 24px;
    line-height: 1.05;
    font-weight: 900;
  }

  .counter-card {
    min-width: 70px;
    padding: 9px 12px;
    border-radius: 16px;
    border: 1px solid rgba(34, 197, 94, 0.3);
    background: rgba(34, 197, 94, 0.12);
    text-align: center;
  }

  .counter-card span {
    font-size: 24px;
    font-weight: 900;
  }

  .counter-card small {
    margin-left: 2px;
    color: rgba(255, 255, 255, 0.55);
    font-weight: 800;
  }

  .invite-section {
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
    text-align: center;
  }

  .copy-link-button {
    width: 100%;
    margin-top: 9px;
    padding: 10px 12px;
    border-radius: 13px;
    border: 1px solid rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.11);
    color: #86efac;
    font-size: 13px;
    font-weight: 800;
  }

  .room-code {
    margin: 10px 0 12px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 11px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .room-code strong {
    color: rgba(255, 255, 255, 0.86);
  }

  .qr-wrap {
    width: min(220px, 62vw);
    margin: 0 auto;
    padding: 10px;
    border-radius: 18px;
    border: 1px solid rgba(34, 197, 94, 0.35);
    background: #052e16;
  }

  .qr-wrap :global(canvas),
  .qr-wrap :global(svg),
  .qr-wrap :global(img) {
    width: 100% !important;
    height: auto !important;
    display: block;
  }

  .hint-text {
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    line-height: 1.35;
  }

  .players-section {
    margin-top: 14px;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.045);
  }

  .players-header {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .players-header h2 {
    margin: 3px 0 0;
    font-size: 18px;
    font-weight: 850;
  }

  .ready-badge {
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .players-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .player-card {
    min-width: 0;
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .host-only-card {
    min-width: 0;
    margin-bottom: 9px;
    padding: 11px;
    border: 1px solid rgba(96, 165, 250, 0.3);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: rgba(30, 64, 175, 0.12);
  }

  .host-only-card > span {
    padding: 5px 7px;
    border-radius: 999px;
    background: rgba(96, 165, 250, 0.16);
    color: #bfdbfe;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.08em;
  }

  .player-left {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    flex: 0 0 auto;
  }

  .player-text {
    min-width: 0;
  }

  .player-name {
    min-width: 0;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .host-badge {
    margin-left: 5px;
    padding: 2px 5px;
    border-radius: 999px;
    background: rgba(250, 204, 21, 0.16);
    color: #fde68a;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .player-subtext {
    margin-top: 1px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 11px;
  }

  .ready-check,
  .not-ready-check {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 900;
    flex: 0 0 auto;
  }

  .ready-check {
    border: 1px solid rgba(34, 197, 94, 0.32);
    background: rgba(34, 197, 94, 0.18);
    color: #86efac;
  }

  .not-ready-check {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.18);
  }

  .bottom-panel {
    width: 100%;
    max-width: 440px;
    margin: 12px auto 0;
    padding: 12px 14px 14px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(8, 8, 8, 0.96);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .host-panel-button {
    width: 100%;
    margin-bottom: 9px;
    padding: 11px 14px;
    border: 1px solid rgba(96, 165, 250, 0.38);
    border-radius: 13px;
    background: rgba(30, 64, 175, 0.16);
    color: #bfdbfe;
    font-size: 13px;
    font-weight: 800;
  }

  .host-only-note {
    margin: 9px 0 0;
    color: rgba(191, 219, 254, 0.72);
    font-size: 11px;
    line-height: 1.4;
    text-align: center;
  }

  .swipe-text {
    color: rgba(255, 255, 255, 0.66);
    font-size: 12px;
    font-weight: 700;
  }

  .page-dots {
    margin: 9px 0 12px;
    display: flex;
    justify-content: center;
    gap: 9px;
  }

  .dot {
    width: 11px;
    height: 11px;
    padding: 0;
    border: none;
    border-radius: 999px;
    transition: 0.15s ease;
  }

  .active-dot {
    background: #4ade80;
    box-shadow: 0 0 14px rgba(74, 222, 128, 0.6);
  }

  .inactive-dot {
    background: #374151;
  }

  @media (min-width: 720px) {
    .lobby-page {
      padding: 22px;
    }

    .lobby-card {
      padding: 22px;
    }

    .title-wrap {
      transform: scale(1);
    }

    .lobby-header h1 {
      font-size: 30px;
    }

    .qr-wrap {
      width: min(310px, 60vw);
      padding: 14px;
    }

    .players-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .player-name {
      font-size: 15px;
    }

    .bottom-panel {
      margin-top: 18px;
      padding: 14px 16px 16px;
      border-radius: 22px;
    }

    .tutorial-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 18px;
    }

    .tutorial-item {
      display: flex;
      gap: 14px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(34, 197, 94, 0.18);
      background: rgba(34, 197, 94, 0.07);
    }

    .tutorial-item.danger {
      border-color: rgba(239, 68, 68, 0.22);
      background: rgba(239, 68, 68, 0.08);
    }

    .tutorial-item > span {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      font-size: 12px;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.82);
    }

    .tutorial-item h2 {
      margin: 0 0 6px;
      font-size: 17px;
      font-weight: 900;
    }

    .tutorial-item p {
      margin: 0;
      color: rgba(255, 255, 255, 0.66);
      font-size: 14px;
      line-height: 1.4;
    }

  }

  /* Responsive shell: content scrolls independently from the primary action. */
  .lobby-page {
    height: var(--app-height);
    min-height: 0;
    padding:
      max(10px, var(--safe-top))
      max(10px, var(--safe-right))
      max(10px, var(--safe-bottom))
      max(10px, var(--safe-left));
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 10px;
    overflow: hidden;
  }

  .swipe-area {
    width: 100%;
    max-width: none;
    min-height: 0;
    padding: 2px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scrollbar-width: thin;
  }

  .lobby-card,
  .tutorial-card {
    max-width: 760px;
    margin: 0 auto;
  }

  .tutorial-card {
    min-height: 100%;
    padding: clamp(16px, 4vw, 28px);
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .tutorial-card > h1 {
    margin: 7px 0 0;
    font-size: clamp(25px, 7vw, 38px);
    line-height: 1.05;
    font-weight: 950;
    overflow-wrap: anywhere;
  }

  .tutorial-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(8px, 2vh, 14px);
    margin-top: clamp(14px, 3vh, 22px);
  }

  .tutorial-item {
    min-width: 0;
    display: flex;
    gap: 11px;
    padding: clamp(11px, 3vw, 16px);
    border-radius: 16px;
    border: 1px solid rgba(34, 197, 94, 0.18);
    background: rgba(34, 197, 94, 0.07);
  }

  .tutorial-item.danger {
    border-color: rgba(239, 68, 68, 0.22);
    background: rgba(239, 68, 68, 0.08);
  }

  .tutorial-item > span {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.82);
    font-size: 11px;
    font-weight: 900;
  }

  .tutorial-item > div {
    min-width: 0;
  }

  .tutorial-item h2 {
    margin: 0 0 5px;
    font-size: clamp(14px, 4vw, 17px);
    line-height: 1.2;
    font-weight: 900;
    overflow-wrap: anywhere;
  }

  .tutorial-item p {
    margin: 0;
    color: rgba(255, 255, 255, 0.66);
    font-size: clamp(12px, 3.2vw, 14px);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .bottom-panel {
    margin: 0 auto;
    padding: 10px 14px 12px;
  }

  .swipe-text {
    text-align: center;
  }

  .page-navigation {
    margin: 7px 0 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }

  .page-dots {
    margin: 0;
    display: flex;
    align-items: center;
  }

  .page-arrow {
    width: 34px;
    height: 30px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.07);
    color: #d1fae5;
    font-size: 24px;
    line-height: 1;
  }

  .page-arrow:disabled {
    opacity: 0.25;
  }

  .dot {
    width: 30px;
    height: 24px;
    padding: 6px 9px;
    background-clip: content-box;
  }

  @media (min-width: 720px) {
    .tutorial-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .bottom-panel {
      margin-top: 0;
    }
  }

  @media (max-width: 380px) {
    .lobby-card {
      padding: 12px;
    }

    .invite-section,
    .players-section {
      padding: 11px;
    }

    .ready-badge,
    .swipe-text {
      font-size: 10px;
    }
  }

  @media (orientation: landscape) and (max-height: 560px) {
    .lobby-page {
      grid-template-columns: minmax(0, 1fr) minmax(220px, 32vw);
      grid-template-rows: minmax(0, 1fr);
    }

    .bottom-panel {
      align-self: center;
    }

    .tutorial-card {
      min-height: auto;
    }

    .tutorial-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
