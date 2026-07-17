<script lang="ts">
  import { t } from "$lib/i18n";

  export let taskProgress = 50;
  export let showLabel = true;

  $: normalizedProgress = Math.max(0, Math.min(100, taskProgress));
</script>

<div class="task-progress">
  {#if showLabel}
    <div class="task-progress-heading">
      <span>{$t("taskbar.label")}</span>
      <small>{$t("taskbar.delay")}</small>
    </div>
  {/if}

  <div
    class="task-progress-track"
    role="progressbar"
    aria-label={$t("taskbar.label")}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(normalizedProgress)}
  >
    <span style={`width:${normalizedProgress}%`}></span>
  </div>

  <strong>{Math.round(normalizedProgress)}%</strong>
</div>

<style>
  .task-progress {
    min-width: 0;
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px 11px;
  }

  .task-progress-heading {
    grid-column: 1 / -1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    font-weight: 900;
  }

  .task-progress-heading small {
    color: rgba(255, 255, 255, 0.38);
    font-size: 9px;
    font-weight: 700;
  }

  .task-progress-track {
    height: 9px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.48);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .task-progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #15803d, #4ade80, #bbf7d0);
    box-shadow: 0 0 16px rgba(74, 222, 128, 0.42);
    transition: width 320ms ease;
  }

  .task-progress strong {
    min-width: 34px;
    color: #86efac;
    font-size: 11px;
    font-weight: 950;
    text-align: right;
  }

  @media (prefers-reduced-motion: reduce) {
    .task-progress-track span { transition: none; }
  }
</style>
