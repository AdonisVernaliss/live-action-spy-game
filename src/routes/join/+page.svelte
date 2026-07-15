<script lang="ts">
  import { onMount } from "svelte";
  import { getSocketIO } from "$lib/websocket";
  import { page } from "$app/stores";
  import MainButton from "$lib/MainButton.svelte";
  import Title from "$lib/Title.svelte";
  import NameInput from "$lib/NameInput.svelte";
  import { deviceIsSupported, gotoReplace } from "$lib/util";
  import type { Socket } from "socket.io-client";
  import { lobbyStore, playerColorStore } from "$lib/stores";
  import type { Color } from "$lib/types";
  import { language, localizeServerMessage, t } from "$lib/i18n";

  let socket: Socket;
  let joinCode = "";
  let deviceSupported = false;
  let playerName = "";
  let error = "";
  let creator = "";
  let joining = false;

  function joinLobby() {
    const name = playerName.trim();

    if (!name) {
      error = "Введите ник";
      return;
    }

    if (!joinCode) {
      error = "Не указан код лобби";
      return;
    }

    if (joining) return;

    joining = true;
    error = "";

    console.debug("joinLobby emit", {
      name,
      lobbyId: joinCode,
      socketConnected: socket?.connected,
    });

    socket.emit("joinLobby", {
      name,
      lobbyId: joinCode,
    });
  }

  onMount(() => {
    deviceSupported = deviceIsSupported();

    if (!deviceSupported) return;

    const urlCode = $page.url.searchParams.get("code");

    if (urlCode == null || urlCode.trim() === "") {
      gotoReplace("/");
      return;
    }

    joinCode = urlCode;
    creator = $page.url.searchParams.get("creator") ?? "";

    socket = getSocketIO();

    socket.on("error", ({ error: err }: { error: string }) => {
      joining = false;
      error = err;
      console.error("join error", err);
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

        gotoReplace("/lobby");
      }
    );

    return () => {
      socket.off("error");
      socket.off("joinedLobby");
    };
  });
</script>

<div class="join-page">
  {#if deviceSupported}
    <Title />

    <section class="join-card">
      <div class="join-header">
        <h1>{$t("join.title")}</h1>

        {#if creator}
          <p>{$t("join.byHost", { creator })}</p>
        {:else}
          <p>{$t("join.subtitle")}</p>
        {/if}
      </div>

      <div class="name-section">
        <NameInput bind:playerName />

        <p class:invisible={error === ""} class="error-text">
          {localizeServerMessage(error, $language)}&nbsp;
        </p>
      </div>

      <div class="code-box">
        <span>{$t("join.code")}</span>
        <strong>{joinCode}</strong>
      </div>

      <div class="main-action">
        <MainButton disabled={joining} on:click={joinLobby}>
          {joining ? $t("join.connecting") : $t("join.action")}
        </MainButton>
      </div>
    </section>
  {:else}
    <div class="unsupported-box">
      {$t("common.unsupported")}<br />
      {$t("common.browserHint")}
    </div>
  {/if}
</div>

<style>
  .join-page {
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

  .join-card {
    width: 100%;
    max-width: 440px;
    margin-bottom: clamp(12px, 7vh, 64px);
    padding: clamp(18px, 5vw, 28px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  }

  .join-header {
    margin-bottom: 24px;
    text-align: center;
  }

  .join-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
  }

  .join-header p {
    margin: 8px 0 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 14px;
  }

  .name-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-top: 8px;
  }

  .error-text {
    margin-top: 12px;
    font-size: 14px;
    color: #f87171;
  }

  .code-box {
    margin-top: 16px;
    padding: 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .code-box span {
    display: block;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .code-box strong {
    display: block;
    margin-top: 6px;
    color: #86efac;
    font-size: 15px;
    overflow-wrap: anywhere;
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
    .join-page {
      justify-content: flex-start;
      gap: 16px;
      overflow-y: auto;
    }

    .join-card {
      margin-bottom: 0;
    }

    .join-header {
      margin-bottom: 14px;
    }
  }
</style>
