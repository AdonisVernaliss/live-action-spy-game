<script lang="ts">
  import { dev, DEV_PANEL_KEY } from "$lib/consts";
  import DevPanel from "$lib/DevPanel.svelte";
  import NotificationBar from "$lib/NotificationBar.svelte";
  import ConnectionBanner from "$lib/ConnectionBanner.svelte";
  import {
    lobbyStore,
    connectionStore,
    notificationStore,
    playerColorStore,
    playerStore,
    showNotificationBar,
  } from "$lib/stores";
  import { getSocketIO } from "$lib/websocket";
  import { onMount } from "svelte";
  import "../app.postcss";
  import { page } from "$app/stores";
  import type { Color } from "$lib/types";
  import { gotoReplace } from "$lib/util";
  import type { Socket } from "socket.io-client";
  import LanguageToggle from "$lib/LanguageToggle.svelte";
  import { initializeLanguage, language, t } from "$lib/i18n";
  import {
    setWakeLockDesired,
    startWakeLockManager,
  } from "$lib/wakeLock";

  let showDevPanel = false;
  let socket: Socket;
  let reconnectInFlight = false;
  let connectionWasLost = false;
  let wakeLockManagerReady = false;

  $: shouldKeepScreenAwake =
    $page.route.id === "/admin" ||
    ($lobbyStore != null &&
      !["/", "/join", "/adminlinks", "/gameover"].includes(
        $page.route.id ?? ""
      ));
  $: if (wakeLockManagerReady) {
    setWakeLockDesired(shouldKeepScreenAwake);
  }

  function debugLog(label: string, data: any = {}) {
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("DEBUG_GAME") === "1"
    ) {
      console.log(`[LAYOUT] ${label}`, {
        route: $page.route.id,
        lobbyState: $lobbyStore?.status.state,
        player: $playerStore?.name,
        playerStatus: $playerStore?.status,
        ...data,
      });
    }
  }

  function isRouteProtectedFromGameRedirect(routeId: string | null) {
    if (routeId == null) return false;

    return (
      routeId === "/" ||
      routeId === "/join" ||
      routeId === "/scan" ||
      routeId === "/sync" ||
      routeId === "/minigamedone" ||
      routeId === "/rules" ||
      routeId === "/adminlinks" ||
      routeId === "/admin" ||
      routeId === "/testNfc" ||
      routeId.includes("minigame")
    );
  }

  function isRouteProtectedFromEveryGamePhase(routeId: string | null) {
    return (
      routeId === "/" ||
      routeId === "/join" ||
      routeId === "/admin" ||
      routeId === "/adminlinks" ||
      routeId === "/testNfc" ||
      routeId?.includes("minigame") === true
    );
  }

  function getStartedGameRoute(playerStatus: string | undefined) {
    if (playerStatus === "alive") return "/game";
    if (playerStatus === "dead") return "/killed";
    return "/dead";
  }

  function isLobbyCreator(lobby: any, color: Color | null) {
    return color != null && lobby?.players?.[color]?.name === lobby?.creator;
  }

  function navigateAfterReconnect(color: Color | null) {
    const lobby = $lobbyStore;
    const routeId = $page.route.id;

    debugLog("navigateAfterReconnect:start");

    // A saved session must never steal a freshly opened invitation or the
    // start page. The player may deliberately be joining another lobby.
    if (isRouteProtectedFromEveryGamePhase(routeId)) return;

    if (lobby == null) {
      gotoReplace("/");
      return;
    }

    const currentPlayer =
      color == null ? null : lobby.players?.[color];

    if (currentPlayer?.isHostOnly) {
      if (lobby.status.state === "settingRooms") gotoReplace("/setuprooms");
      else if (lobby.status.state === "inLobby") gotoReplace("/lobby");
      else gotoReplace("/admin");
      return;
    }

    const playerStatus = $playerStore?.status;

    switch (lobby.status.state) {
      case "meetingCalled":
        gotoReplace("/meetingcall");
        break;

      case "inLobby":
        gotoReplace("/lobby");
        break;

      case "meeting":
        gotoReplace("/vote");
        break;

      case "roleExplanation":
        gotoReplace("/role");
        break;

      case "settingRooms":
        gotoReplace(isLobbyCreator(lobby, color) ? "/setuprooms" : "/lobby");
        break;

      case "started":
        if (
          lobby.playerSync?.state === "active" ||
          lobby.playerSync?.state === "waiting"
        ) {
          if (routeId !== "/sync" && routeId !== "/scan") {
            gotoReplace("/sync");
          }
          break;
        }

        if (isRouteProtectedFromGameRedirect(routeId)) {
          break;
        }

        gotoReplace(getStartedGameRoute(playerStatus));
        break;

      case "voteResultAnnounced":
        gotoReplace("/voteover");
        break;

      case "gameEnded":
        gotoReplace("/gameover");
        break;
    }
  }

  function tryReconnect() {
    if (reconnectInFlight || !socket.connected) return;

    const storedGameInfo = localStorage.getItem("gameInfo");

    debugLog("tryReconnect:stored", {
      storedGameInfo,
    });

    let gameInfo: { playerId: string; lobbyId: string; color: Color } | null =
      null;

    if (storedGameInfo != null) {
      try {
        const parsed = JSON.parse(storedGameInfo);
        if (
          typeof parsed?.playerId !== "string" ||
          typeof parsed?.lobbyId !== "string" ||
          typeof parsed?.color !== "string"
        ) {
          throw new Error("Saved session is incomplete");
        }
        gameInfo = parsed;
      } catch {
        localStorage.removeItem("gameInfo");
        localStorage.removeItem("currentTaskNumber");
        localStorage.removeItem("currentTaskTag");
        connectionStore.set("connected");
        gotoReplace("/");
        return;
      }
    }

    if (gameInfo == null) return;
    reconnectInFlight = true;
    connectionStore.set("reconnecting");

    socket.once(
      "reconnected",
      ({
        success,
        lobby,
        color,
      }: {
        success: boolean;
        lobby: any;
        color: Color;
      }) => {
        reconnectInFlight = false;
        debugLog("tryReconnect:response", {
          success,
          lobbyState: lobby?.status?.state,
          color,
        });

        if (success) {
          connectionStore.set("connected");
          playerColorStore.set(color);
          lobbyStore.set(lobby);
          navigateAfterReconnect(color);
        } else {
          connectionStore.set("connected");
          localStorage.removeItem("gameInfo");
          localStorage.removeItem("currentTaskNumber");
          localStorage.removeItem("currentTaskTag");
          gotoReplace("/");
        }
      }
    );

    debugLog("tryReconnect:emit", { gameInfo });

    socket.emit("reconnect", {
      color: gameInfo.color,
      playerId: gameInfo.playerId,
      lobbyId: gameInfo.lobbyId,
    });
  }

  onMount(() => {
    initializeLanguage();
    const stopWakeLockManager = startWakeLockManager();
    wakeLockManagerReady = true;
    setWakeLockDesired(shouldKeepScreenAwake);
    socket = getSocketIO();

    debugLog("onMount", {
      socketConnected: socket.connected,
    });

    socket.on("lobbyUpdate", ({ lobby }: { lobby: any }) => {
      debugLog("socket:lobbyUpdate", {
        incomingState: lobby?.status?.state,
        lobbyId: lobby?.id,
      });

      lobbyStore.set(lobby);
    });

    const onDisconnect = () => {
      connectionWasLost = true;
    };

    const onConnect = () => {
      const shouldRestoreConnection = connectionWasLost;
      if (connectionWasLost) {
        connectionWasLost = false;
      }

      if (
        shouldRestoreConnection ||
        ($lobbyStore == null &&
          $page.route.id !== "/" &&
          $page.route.id !== "/join")
      ) {
        tryReconnect();
      }
    };

    const onOffline = () => connectionStore.set("offline");
    const onOnline = () => {
      if (!socket.connected) connectionStore.set("reconnecting");
    };

    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    socket.on("countDown", ({ count }: { count: number }) => {
      lobbyStore.update((lobby) => {
        if (lobby != null && "countDown" in lobby.status) {
          lobby.status.countDown = count;
          return lobby;
        }

        return lobby;
      });
    });

    socket.on(
      "cooldownUpdate",
      ({
        cooldowns,
        firewall,
      }: {
        cooldowns: Record<string, any>;
        firewall: number | null;
      }) => {
        lobbyStore.update((lobby) => {
          if (lobby != null) {
            for (const [color, cds] of Object.entries(cooldowns)) {
              const players = lobby.players as Record<string, any>;
              const player = players[color];

              if (player?.role?.name === "impostor") {
                player.role.killCooldown = cds.killCooldown;
                player.role.sabotageCooldown = cds.sabotageCooldown;
              }
            }

            if (
              firewall != null &&
              lobby.activeEffects.firewallBreach != null
            ) {
              lobby.activeEffects.firewallBreach.countDown = firewall;
            }
          }

          return lobby;
        });
      }
    );

    const unsubLobby = lobbyStore.subscribe((lobby) => {
      if (lobby == null) return;

      debugLog("lobbyStore:subscribe", {
        newState: lobby.status.state,
      });

      if (isRouteProtectedFromEveryGamePhase($page.route.id)) return;

      if ($playerStore?.isHostOnly) {
        const targetRoute =
          lobby.status.state === "settingRooms"
            ? "/setuprooms"
            : lobby.status.state === "inLobby"
              ? "/lobby"
              : "/admin";

        if ($page.route.id !== targetRoute) gotoReplace(targetRoute);
        return;
      }

      switch (lobby.status.state) {
        case "settingRooms": {
          if (isRouteProtectedFromGameRedirect($page.route.id)) break;

          const targetRoute = isLobbyCreator(lobby, $playerColorStore)
            ? "/setuprooms"
            : "/lobby";
          if ($page.route.id !== targetRoute) {
            gotoReplace(targetRoute);
          }
          break;
        }

        case "roleExplanation":
          if ($page.route.id !== "/role") {
            gotoReplace("/role");
          }
          break;

        case "started":
          if (
            lobby.playerSync?.state === "active" ||
            lobby.playerSync?.state === "waiting"
          ) {
            if ($page.route.id !== "/sync" && $page.route.id !== "/scan") {
              gotoReplace("/sync");
            }
            break;
          }

          if (isRouteProtectedFromGameRedirect($page.route.id)) {
            break;
          }

          const targetRoute = getStartedGameRoute($playerStore?.status);
          if ($page.route.id !== targetRoute) {
            gotoReplace(targetRoute);
          }
          break;

        case "meetingCalled":
          if ($page.route.id !== "/meetingcall") {
            gotoReplace("/meetingcall");
          }
          break;

        case "meeting":
          if ($page.route.id !== "/vote") {
            gotoReplace("/vote");
          }
          break;

        case "voteResultAnnounced":
          if ($page.route.id !== "/voteover") {
            gotoReplace("/voteover");
          }
          break;

        case "gameEnded":
          if ($page.route.id !== "/gameover") {
            gotoReplace("/gameover");
          }
          break;
      }
    });

    const unsubPlayer = playerStore.subscribe((player) => {
      const gameState = $lobbyStore?.status.state;

      if (player == null) return;

      if (player.isHostOnly) return;

      debugLog("playerStore:subscribe", {
        status: player.status,
        gameState,
      });

      if (isRouteProtectedFromGameRedirect($page.route.id)) {
        return;
      }

      if (
        gameState === "meetingCalled" ||
        gameState === "meeting" ||
        gameState === "voteResultAnnounced" ||
        gameState === "gameEnded"
      ) {
        return;
      }

      switch (player.status) {
        case "foundDead":
          if ($page.route.id !== "/dead") {
            gotoReplace("/dead");
          }
          break;

        case "dead":
          if ($page.route.id !== "/killed") {
            gotoReplace("/killed");
          }
          break;
      }
    });

    const publicRoutes = [
      "/",
      "/join",
      "/scan",
      "/rules",
      "/adminlinks",
      "/admin",
      "/testNfc",
    ];

    if (
      !publicRoutes.includes($page.route.id ?? "") &&
      !$page.route.id?.includes("minigame")
    ) {
      tryReconnect();
    }

    return () => {
      unsubLobby();
      unsubPlayer();

      socket.off("lobbyUpdate");
      socket.off("countDown");
      socket.off("cooldownUpdate");
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      wakeLockManagerReady = false;
      stopWakeLockManager();
    };
  });

  const noNotiBarPages = [
    "/",
    "/setuprooms",
    "/lobby",
    "/role",
    "/join",
    "/gameover",
    "/awaitMeeting",
    "/rules",
    "/adminlinks",
    "/admin",
    "/sync",
  ];

  $: displayNotificationBar =
    noNotiBarPages.find((route) => $page.route.id === route) == null &&
    $showNotificationBar;

  $: displayHostPanelButton =
    $lobbyStore != null &&
    $playerStore?.name === $lobbyStore.creator &&
    $playerStore?.isHostOnly !== true &&
    !["/", "/join", "/admin", "/setuprooms", "/lobby"].includes(
      $page.route.id ?? ""
    );

  $: displayPauseOverlay =
    $lobbyStore?.pause?.active === true && $page.route.id !== "/admin";
</script>

<svelte:head>
  <title>{$t("common.protocol")}</title>
  <meta
    name="description"
    content={$language === "en"
      ? "Protocol 150 — a team role-playing game for a physical venue"
      : "Протокол 150 — командная ролевая игра для реальной площадки"}
  />
  <meta name="theme-color" content="#000000" />
</svelte:head>

<div
  id="main-panel"
  class="bg-black items-center flex flex-col text-white font-mono select-none relative"
>
  <LanguageToggle />
  <ConnectionBanner />

  {#if displayNotificationBar}
    <NotificationBar notificationMessage={$notificationStore} />
  {/if}

  {#if displayHostPanelButton}
    <button
      type="button"
      class="host-panel-fab"
      on:click={() => gotoReplace("/admin")}
      aria-label={$t("layout.hostPanelAria")}
    >
      {$t("layout.hostPanel")}
    </button>
  {/if}

  {#if displayPauseOverlay}
    <div class="pause-overlay" role="status" aria-live="assertive">
      <div class="pause-card">
        <span>{$t("pause.badge")}</span>
        <h2>{$t("pause.title")}</h2>
        <p>{$t("pause.text")}</p>
      </div>
    </div>
  {/if}

  <slot />

  {#if dev && showDevPanel}
    <DevPanel />
  {/if}
</div>

<style>
  #main-panel {
    width: 100%;
    min-height: var(--app-height);
    overflow-x: clip;
  }

  .host-panel-fab {
    position: fixed;
    z-index: 70;
    top: max(10px, var(--safe-top));
    right: max(10px, var(--safe-right));
    min-height: 38px;
    padding: 8px 11px;
    border: 1px solid rgba(96, 165, 250, 0.48);
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.9);
    color: #bfdbfe;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.06em;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  }

  .pause-overlay {
    position: fixed;
    inset: 0;
    z-index: 85;
    padding: max(18px, var(--safe-top)) max(18px, var(--safe-right))
      max(18px, var(--safe-bottom)) max(18px, var(--safe-left));
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(10px);
  }

  .pause-card {
    width: min(100%, 430px);
    padding: clamp(24px, 7vw, 38px);
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: 24px;
    background: #11100b;
    text-align: center;
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.65);
  }

  .pause-card span {
    color: #fbbf24;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: 0.2em;
  }

  .pause-card h2 {
    margin: 10px 0 8px;
    font-size: clamp(24px, 7vw, 34px);
    font-weight: 950;
  }

  .pause-card p {
    margin: 0;
    color: rgba(255, 255, 255, 0.66);
    font-size: 14px;
    line-height: 1.5;
  }
</style>

<svelte:window
  on:keydown={(e) => {
    if (e.ctrlKey && e.key === DEV_PANEL_KEY) {
      showDevPanel = !showDevPanel;
    }
  }}
/>
