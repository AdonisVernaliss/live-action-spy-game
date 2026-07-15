<script lang="ts">
  import { onMount } from "svelte";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { t } from "$lib/i18n";

  onMount(() => {
    if ($lobbyStore == null || $playerStore == null) {
      gotoReplace("/");
      return;
    }

    if ($playerStore.status === "foundDead") {
      gotoReplace("/dead");
      return;
    }

    if ($playerStore.status === "alive") {
      gotoReplace("/game");
      return;
    }
  });

  $: if ($playerStore?.status === "foundDead") {
    gotoReplace("/dead");
  }

  $: if ($playerStore?.status === "alive") {
    gotoReplace("/game");
  }

  $: if ($lobbyStore?.status.state === "meetingCalled") {
    gotoReplace("/dead");
  }

  $: if ($lobbyStore?.status.state === "meeting") {
    gotoReplace("/dead");
  }

  $: if ($lobbyStore?.status.state === "voteResultAnnounced") {
    gotoReplace("/dead");
  }

  $: if ($lobbyStore?.status.state === "gameEnded") {
    gotoReplace("/gameover");
  }
</script>

<main class="killed-page">
  <section class="killed-card">
    <p class="eyebrow">{$t("killed.eyebrow")}</p>

    <h1>{$t("killed.title")}</h1>

    <p class="description">
      {$t("killed.text")}
    </p>

    <div class="rules-box">
      <p>{$t("killed.rule1")}</p>
      <p>{$t("killed.rule2")}</p>
      <p>{$t("killed.rule3")}</p>
    </div>
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .killed-page {
    min-height: var(--app-height);
    width: 100%;
    padding: 20px;
    background:
      radial-gradient(circle at top, rgba(239, 68, 68, 0.2), transparent 30rem),
      #000;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .killed-card {
    width: 100%;
    max-width: 460px;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(8, 8, 8, 0.94);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
  }

  .eyebrow {
    margin: 0;
    color: rgba(252, 165, 165, 0.9);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 8px 0 14px;
    font-size: 34px;
    line-height: 1.1;
    font-weight: 900;
  }

  .description {
    margin: 0 0 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 15px;
    line-height: 1.45;
  }

  .rules-box {
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(239, 68, 68, 0.22);
    background: rgba(127, 29, 29, 0.22);
  }

  .rules-box p {
    margin: 8px 0;
    color: rgba(254, 226, 226, 0.92);
    font-size: 14px;
  }
</style>
