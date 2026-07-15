<script lang="ts">
  import { dev } from "$lib/consts";
  import MainButton from "$lib/MainButton.svelte";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { getSocketIO } from "$lib/websocket";
  import { gotoReplace } from "$lib/util";
  import type { Socket } from "socket.io-client";
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";

  let io: Socket;

  onMount(() => {
    io = getSocketIO();
  });

  $: roleName = $playerStore?.role.name;

  $: displayRole =
    roleName === "crew"
      ? $t("role.crew")
      : roleName === "impostor"
        ? $t("role.impostor")
        : $t("role.unknown");

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

  function startNowDev() {
    io.emit("devSetLobby", {
      lobby: { status: { state: "roleExplanation", countDown: 1 } },
    });
  }
</script>

<div class="role-page">
  <section class="role-card">
    <p class="eyebrow">{$t("role.eyebrow")}</p>

    {#if $playerStore == null || roleName == null}
      <h1>{$t("role.loading")}</h1>
      <p class="description">
        {$t("role.loadingText")}
      </p>
    {:else}
      <h1>{$t("role.yours", { role: displayRole })}</h1>

      {#if roleName === "impostor"}
        <div class="info-box impostor-box">
          <p>
            {$t("role.impostorText")}
          </p>

          <p>
            {$t("role.impostorScan")}
          </p>
        </div>
      {:else}
        <div class="info-box crew-box">
          <p>
            {$t("role.crewText")}
          </p>

          <p>
            {$t("role.crewScan")}
          </p>
        </div>
      {/if}
    {/if}

    {#if $lobbyStore?.status.state === "roleExplanation"}
      <div class="start-box">
        <MainButton disabled={!dev} on:click={startNowDev}>
          {$t("role.startsIn", { seconds: $lobbyStore.status.countDown })}

          {#if dev}
            <br />
            <span class="text-sm text-gray-300">
              {$t("role.dev")}
            </span>
          {/if}
        </MainButton>
      </div>
    {/if}
  </section>
</div>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .role-page {
    min-height: var(--app-height);
    width: 100%;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.14), transparent 32rem),
      #000;
    color: white;
  }

  .role-card {
    width: 100%;
    max-width: 520px;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(8, 8, 8, 0.94);
    text-align: center;
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
    margin: 12px 0 18px;
    font-size: 30px;
    line-height: 1.1;
    font-weight: 900;
  }

  .description {
    color: rgba(255, 255, 255, 0.7);
  }

  .info-box {
    margin-top: 18px;
    padding: 18px;
    border-radius: 18px;
    text-align: left;
  }

  .info-box p {
    margin: 0 0 12px;
    color: rgba(255, 255, 255, 0.74);
    line-height: 1.45;
  }

  .info-box p:last-child {
    margin-bottom: 0;
  }

  .crew-box {
    border: 1px solid rgba(34, 197, 94, 0.22);
    background: rgba(34, 197, 94, 0.07);
  }

  .impostor-box {
    border: 1px solid rgba(239, 68, 68, 0.24);
    background: rgba(239, 68, 68, 0.08);
  }

  .start-box {
    margin-top: 24px;
  }
</style>
