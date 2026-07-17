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
  $: isAgent = roleName === "impostor";

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
  <div class="role-aura" class:agent={isAgent} aria-hidden="true"></div>
  <section class="role-card" class:agent={isAgent}>
    <p class="eyebrow">{$t("role.eyebrow")}</p>

    {#if $playerStore == null || roleName == null}
      <div class="role-emblem loading" aria-hidden="true">
        <span>···</span>
      </div>
      <h1 class="loading-title">{$t("role.loading")}</h1>
      <p class="description">
        {$t("role.loadingText")}
      </p>
    {:else}
      <div class="role-emblem" class:agent={isAgent} aria-hidden="true">
        <span>{isAgent ? "A" : "O"}</span>
        <i></i>
      </div>

      <p class="reveal-label">{$t("role.revealLabel")}</p>
      <h1>{displayRole}</h1>

      <div class="briefing-grid">
        <article>
          <span class="briefing-index">01</span>
          <div>
            <h2>{$t("role.mission")}</h2>
            <p>{isAgent ? $t("role.impostorText") : $t("role.crewText")}</p>
          </div>
        </article>

        <article>
          <span class="briefing-index">02</span>
          <div>
            <h2>{$t("role.fieldProtocol")}</h2>
            <p>{isAgent ? $t("role.impostorScan") : $t("role.crewScan")}</p>
          </div>
        </article>
      </div>
    {/if}

    {#if $lobbyStore?.status.state === "roleExplanation"}
      <div class="start-box" class:agent={isAgent}>
        <div class="countdown">
          <span>{$t("role.launch")}</span>
          <strong>{$lobbyStore.status.countDown}</strong>
        </div>
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
    position: relative;
    isolation: isolate;
    min-height: var(--app-height);
    width: 100%;
    padding:
      max(70px, calc(var(--safe-top) + 58px))
      max(16px, var(--safe-right))
      max(20px, var(--safe-bottom))
      max(16px, var(--safe-left));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 22%, rgba(34, 197, 94, 0.15), transparent 24rem),
      #000;
    color: white;
  }

  .role-aura {
    position: absolute;
    z-index: -1;
    top: 7%;
    left: 50%;
    width: min(92vw, 520px);
    aspect-ratio: 1;
    transform: translateX(-50%);
    border: 1px solid rgba(74, 222, 128, 0.08);
    border-radius: 50%;
    background: repeating-radial-gradient(circle, transparent 0 42px, rgba(74, 222, 128, 0.035) 43px 44px);
    mask-image: linear-gradient(to bottom, black, transparent 76%);
  }

  .role-aura.agent {
    border-color: rgba(248, 113, 113, 0.08);
    background: repeating-radial-gradient(circle, transparent 0 42px, rgba(248, 113, 113, 0.04) 43px 44px);
  }

  .role-card {
    width: 100%;
    max-width: 520px;
    padding: clamp(22px, 6vw, 30px);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(7, 10, 8, 0.94);
    box-shadow: 0 26px 100px rgba(0, 0, 0, 0.65);
    text-align: center;
  }

  .role-card.agent {
    border-color: rgba(248, 113, 113, 0.18);
    background: rgba(12, 7, 7, 0.95);
  }

  .eyebrow {
    margin: 0;
    color: rgba(134, 239, 172, 0.78);
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.17em;
    text-transform: uppercase;
  }

  .agent .eyebrow { color: rgba(252, 165, 165, 0.82); }

  .role-emblem {
    position: relative;
    width: 104px;
    height: 104px;
    margin: 20px auto 13px;
    border: 1px solid rgba(74, 222, 128, 0.34);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: radial-gradient(circle, rgba(34, 197, 94, 0.2), rgba(20, 83, 45, 0.055) 62%, transparent 64%);
    box-shadow: 0 0 38px rgba(34, 197, 94, 0.12);
  }

  .role-emblem::before,
  .role-emblem::after {
    content: "";
    position: absolute;
    inset: 8px;
    border: 1px dashed rgba(134, 239, 172, 0.24);
    border-radius: 50%;
    animation: orbit 12s linear infinite;
  }

  .role-emblem::after {
    inset: -7px;
    border-style: solid;
    border-color: transparent rgba(134, 239, 172, 0.26);
    animation-direction: reverse;
    animation-duration: 8s;
  }

  .role-emblem.agent {
    border-color: rgba(248, 113, 113, 0.38);
    background: radial-gradient(circle, rgba(239, 68, 68, 0.23), rgba(127, 29, 29, 0.06) 62%, transparent 64%);
    box-shadow: 0 0 38px rgba(239, 68, 68, 0.14);
  }

  .role-emblem.agent::before,
  .role-emblem.agent::after { border-color: rgba(252, 165, 165, 0.24); }

  .role-emblem span {
    font-size: 38px;
    font-weight: 950;
    line-height: 1;
  }

  .role-emblem i {
    position: absolute;
    right: 12px;
    bottom: 15px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 12px #4ade80;
  }

  .role-emblem.agent i { background: #f87171; box-shadow: 0 0 12px #f87171; }
  .role-emblem.loading span { color: rgba(255, 255, 255, 0.56); font-size: 22px; letter-spacing: 0.1em; }

  .reveal-label {
    margin: 0;
    color: rgba(255, 255, 255, 0.48);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 5px 0 20px;
    color: #dcfce7;
    font-size: clamp(29px, 8vw, 40px);
    line-height: 1.03;
    font-weight: 950;
    letter-spacing: -0.035em;
  }

  .agent h1 { color: #fee2e2; }
  .loading-title { margin-top: 12px; color: white; }

  .description {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    line-height: 1.5;
  }

  .briefing-grid {
    display: grid;
    gap: 9px;
    text-align: left;
  }

  .briefing-grid article {
    min-width: 0;
    padding: 13px;
    border: 1px solid rgba(74, 222, 128, 0.15);
    border-radius: 16px;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 10px;
    background: rgba(34, 197, 94, 0.045);
  }

  .agent .briefing-grid article {
    border-color: rgba(248, 113, 113, 0.15);
    background: rgba(239, 68, 68, 0.045);
  }

  .briefing-index {
    color: #4ade80;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.05em;
  }

  .agent .briefing-index { color: #f87171; }

  .briefing-grid h2 {
    margin: 0 0 5px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .briefing-grid p {
    margin: 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 11px;
    line-height: 1.45;
  }

  .start-box {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(74, 222, 128, 0.12);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }

  .start-box.agent { border-color: rgba(248, 113, 113, 0.12); }

  .countdown {
    width: 50px;
    height: 50px;
    border: 1px solid rgba(74, 222, 128, 0.26);
    border-radius: 50%;
    display: grid;
    place-content: center;
    background: rgba(34, 197, 94, 0.06);
  }

  .agent .countdown { border-color: rgba(248, 113, 113, 0.26); background: rgba(239, 68, 68, 0.06); }

  .countdown span { color: rgba(255, 255, 255, 0.42); font-size: 7px; font-weight: 900; text-transform: uppercase; }
  .countdown strong { font-size: 20px; line-height: 1; }

  @keyframes orbit { to { transform: rotate(360deg); } }

  @media (max-height: 740px) {
    .role-page { align-items: start; }
    .role-emblem { width: 84px; height: 84px; margin-top: 14px; }
    .role-emblem span { font-size: 31px; }
    .briefing-grid p { font-size: 10px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .role-emblem::before,
    .role-emblem::after { animation: none; }
  }
</style>
