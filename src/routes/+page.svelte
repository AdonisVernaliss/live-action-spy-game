<script lang="ts">
  import { onMount } from "svelte";
  import { getSocketIO } from "$lib/websocket";
  import MainButton from "$lib/MainButton.svelte";
  import Title from "$lib/Title.svelte";
  import NameInput from "$lib/NameInput.svelte";
  import { deviceIsSupported, gotoReplace } from "$lib/util";
  import type { Socket } from "socket.io-client";
  import { lobbyStore, playerColorStore } from "$lib/stores";
  import type { Color } from "$lib/types";
  import { localizeServerMessage, t } from "$lib/i18n";

  let deviceSupported = false;

  let playerName = "";
  let hostParticipates = false;
  let error = "";
  let socket: Socket;
  let restoringSession = false;

  function createLobby() {
    if (playerName.trim()) {
      socket.emit("createLobby", {
        name: playerName.trim(),
        hostParticipates,
      });
    } else {
      error = $t("common.error.nickname");
    }
  }

  function navigateAfterReconnect(lobby: any, color: Color) {
    if (lobby.players?.[color]?.isHostOnly) {
      if (lobby.status.state === "settingRooms") gotoReplace("/setuprooms");
      else if (lobby.status.state === "inLobby") gotoReplace("/lobby");
      else gotoReplace("/admin");
      return;
    }

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
        gotoReplace(
          lobby.players?.[color]?.name === lobby.creator ? "/setuprooms" : "/lobby"
        );
        break;

      case "started":
        gotoReplace(
          lobby.players?.[color]?.status === "alive"
            ? "/game"
            : lobby.players?.[color]?.status === "dead"
              ? "/killed"
              : "/dead"
        );
        break;

      case "voteResultAnnounced":
        gotoReplace("/voteover");
        break;

      case "gameEnded":
        gotoReplace("/gameover");
        break;

      default:
        gotoReplace("/");
    }
  }

  function continueOldSession() {
    const storedGameInfo = localStorage.getItem("gameInfo");

    if (storedGameInfo == null) {
      restoringSession = false;
      error = $t("start.savedMissing");
      return;
    }

    let gameInfo: { playerId: string; lobbyId: string; color: Color };
    try {
      gameInfo = JSON.parse(storedGameInfo);
      if (!gameInfo.playerId || !gameInfo.lobbyId || !gameInfo.color) {
        throw new Error("Saved session is incomplete");
      }
    } catch {
      localStorage.removeItem("gameInfo");
      localStorage.removeItem("currentTaskNumber");
      restoringSession = false;
      error = $t("start.savedGone");
      return;
    }

    restoringSession = true;

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
        if (success) {
          playerColorStore.set(color);
          lobbyStore.set(lobby);
          navigateAfterReconnect(lobby, color);
        } else {
          localStorage.removeItem("gameInfo");
          localStorage.removeItem("currentTaskNumber");
          restoringSession = false;
          error = $t("start.savedGone");
        }
      }
    );

    socket.emit("reconnect", {
      color: gameInfo.color,
      playerId: gameInfo.playerId,
      lobbyId: gameInfo.lobbyId,
    });
  }

  onMount(() => {
    deviceSupported = deviceIsSupported();

    if (!deviceSupported) return;

    socket = getSocketIO();

    socket.on("error", ({ error: err }: { error: string }) => {
      error = localizeServerMessage(err);
    });

    socket.once(
      "joinedLobby",
      ({
        lobby,
        color,
        id,
      }: {
        lobby: any;
        color: Color;
        id: string;
      }) => {
        console.debug("joinedLobby received", { lobby, color, id });

        playerColorStore.set(color);
        lobbyStore.set(lobby);

        localStorage.setItem(
          "gameInfo",
          JSON.stringify({
            playerId: id,
            lobbyId: lobby.id,
            color,
          })
        );

        restoringSession = false;
        gotoReplace("/setuprooms");
      }
    );

    if (localStorage.getItem("gameInfo") != null) {
      continueOldSession();
    }

    return () => {
      socket.off("error");
      socket.off("joinedLobby");
      socket.off("reconnected");
    };
  });
</script>

<div class="start-page">
  {#if deviceSupported}
    <Title />

    <div class="start-card">
      {#if restoringSession}
        <div class="start-header">
          <h1>{$t("start.old.title")}</h1>
          <p>{$t("start.old.text")}</p>
        </div>

        <div class="old-session-box">
          <span class="session-spinner" aria-hidden="true"></span>
          <p class="old-session-title">{$t("start.old.restoring")}</p>
        </div>
      {:else}
        <div class="start-header">
          <h1>{$t("start.title")}</h1>
          <p>{$t("start.subtitle")}</p>
        </div>

        <div class="name-section">
          <NameInput bind:playerName />

          <fieldset class="host-mode-selector">
            <legend>{$t("start.mode.legend")}</legend>

            <label class:active={!hostParticipates}>
              <input
                type="radio"
                name="host-mode"
                value="host-only"
                checked={!hostParticipates}
                on:change={() => (hostParticipates = false)}
              />
              <span>
                <strong>{$t("start.mode.hostOnly")}</strong>
                <small>{$t("start.mode.hostOnlyText")}</small>
              </span>
              <em>{$t("start.mode.recommended")}</em>
            </label>

            <label class:active={hostParticipates}>
              <input
                type="radio"
                name="host-mode"
                value="host-player"
                checked={hostParticipates}
                on:change={() => (hostParticipates = true)}
              />
              <span>
                <strong>{$t("start.mode.play")}</strong>
                <small>{$t("start.mode.playText")}</small>
              </span>
            </label>
          </fieldset>

          <p class:invisible={error === ""} class="error-text">
            {error}&nbsp;
          </p>
        </div>

        <div class="main-action">
          <MainButton on:click={createLobby}>{$t("start.create")}</MainButton>
        </div>
      {/if}
    </div>
  {:else}
    <div class="unsupported-box">
      {$t("common.unsupported")}<br />
      {$t("common.browserHint")}
    </div>
  {/if}
</div>

<style>
  .start-page {
    min-height: var(--app-height);
    width: 100%;
    padding:
      max(16px, var(--safe-top))
      max(var(--page-gutter), var(--safe-right))
      max(16px, var(--safe-bottom))
      max(var(--page-gutter), var(--safe-left));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    background: #000;
    color: white;
  }

  .start-card {
    width: 100%;
    max-width: 440px;
    margin-bottom: clamp(12px, 7vh, 64px);
    padding: clamp(18px, 5vw, 28px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  }

  .start-header {
    margin-bottom: 24px;
    text-align: center;
  }

  .start-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
  }

  .start-header p {
    margin: 8px 0 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 14px;
  }

  .old-session-box {
    margin-bottom: 24px;
    padding: 16px;
    border: 1px solid rgba(34, 197, 94, 0.35);
    border-radius: 18px;
    background: rgba(34, 197, 94, 0.12);
    text-align: center;
  }

  .old-session-title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: white;
  }

  .session-spinner {
    width: 34px;
    height: 34px;
    margin: 0 auto 12px;
    display: block;
    border: 3px solid rgba(134, 239, 172, 0.2);
    border-top-color: #86efac;
    border-radius: 50%;
    animation: session-spin 0.85s linear infinite;
  }

  @keyframes session-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .name-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-top: 8px;
  }

  .host-mode-selector {
    width: 100%;
    margin: 20px 0 0;
    padding: 0;
    border: 0;
    display: grid;
    gap: 9px;
    text-align: left;
  }

  .host-mode-selector legend {
    width: 100%;
    margin-bottom: 9px;
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .host-mode-selector label {
    min-width: 0;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 15px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.05);
    cursor: pointer;
  }

  .host-mode-selector label.active {
    border-color: rgba(74, 222, 128, 0.5);
    background: rgba(34, 197, 94, 0.12);
  }

  .host-mode-selector input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: #4ade80;
  }

  .host-mode-selector span {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .host-mode-selector strong {
    color: white;
    font-size: 13px;
  }

  .host-mode-selector small {
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
    line-height: 1.35;
  }

  .host-mode-selector em {
    padding: 4px 6px;
    border-radius: 999px;
    background: rgba(74, 222, 128, 0.16);
    color: #86efac;
    font-size: 9px;
    font-style: normal;
    font-weight: 900;
    text-transform: uppercase;
  }

  .error-text {
    margin-top: 12px;
    font-size: 14px;
    color: #f87171;
  }

  .main-action {
    display: flex;
    justify-content: center;
    margin-top: 24px;
  }

  .unsupported-box {
    max-width: 360px;
    margin-top: 120px;
    padding: 20px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    border-radius: 18px;
    background: rgba(239, 68, 68, 0.12);
    color: #fecaca;
    text-align: center;
  }

  @media (max-height: 620px) {
    .start-page {
      justify-content: flex-start;
      gap: 16px;
      overflow-y: auto;
    }

    .start-card {
      margin-bottom: 0;
    }

    .start-header,
    .old-session-box {
      margin-bottom: 14px;
    }
  }

  @media (max-width: 380px) {
    .host-mode-selector label {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .host-mode-selector em {
      grid-column: 2;
      justify-self: start;
    }
  }
</style>
