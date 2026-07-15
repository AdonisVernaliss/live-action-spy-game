<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";
  import { isTestMinigameActive, returnFromTestMinigame } from "$lib/testMinigame";
  import { onMount } from "svelte";

  let testRun = false;

  onMount(() => {
    testRun = isTestMinigameActive();
  });

  function cancelMinigame() {
    if (testRun) returnFromTestMinigame();
    else gotoReplace("/game");
  }
</script>

<div class="minigame-layout">
  <div class="task-toolbar">
    <button type="button" on:click={cancelMinigame}>{testRun
        ? $language === "en" ? "Return to test panel" : "Вернуться в тестовый пульт"
        : $language === "en" ? "Cancel task" : "Отменить задание"}</button>
  </div>
  <div class="minigame-stage">
    <slot />
  </div>
</div>

<style>
  :global(html),
  :global(body) {
    height: 100%;
    overflow: hidden;
  }

  .minigame-layout {
    width: 100%;
    height: var(--app-height);
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    background: #000;
  }

  .task-toolbar {
    position: relative;
    z-index: 80;
    min-width: 0;
    padding:
      max(8px, var(--safe-top))
      max(62px, calc(var(--safe-right) + 8px))
      8px
      max(62px, calc(var(--safe-left) + 8px));
    display: flex;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(3, 3, 3, 0.96);
  }

  .task-toolbar button {
    width: min(100%, 440px);
    min-height: 38px;
    padding: 8px 12px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 10px;
    background: #1f2937;
    color: #e5e7eb;
    font-size: clamp(10px, 2.8vw, 13px);
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .minigame-stage {
    width: 100%;
    min-height: 0;
    overflow: hidden;
  }

  @media (max-height: 560px) and (orientation: landscape) {
    .task-toolbar {
      padding-top: max(4px, var(--safe-top));
      padding-bottom: 4px;
    }

    .task-toolbar button {
      min-height: 30px;
      padding: 5px 10px;
    }
  }
</style>
