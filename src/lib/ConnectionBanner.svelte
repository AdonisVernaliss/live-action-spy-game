<script lang="ts">
  import { connectionStore } from "./stores";
  import { t } from "$lib/i18n";

  $: message =
    $connectionStore === "offline"
      ? $t("connection.offline")
      : $connectionStore === "reconnecting"
        ? $t("connection.reconnecting")
        : $connectionStore === "connecting"
          ? $t("connection.connecting")
          : $connectionStore === "replaced"
            ? $t("connection.replaced")
            : null;
</script>

{#if message != null}
  <div class:session-replaced={$connectionStore === "replaced"} class="connection-banner">
    {message}
  </div>
{/if}

<style>
  .connection-banner {
    position: fixed;
    z-index: 1000;
    top: max(12px, calc(var(--safe-top) + 6px));
    left: 50%;
    width: min(520px, calc(100% - var(--safe-left) - var(--safe-right) - 24px));
    max-width: 520px;
    transform: translateX(-50%);
    padding: 12px 16px;
    border: 1px solid rgba(250, 204, 21, 0.5);
    border-radius: 14px;
    background: rgba(66, 32, 6, 0.96);
    color: #fef9c3;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.35;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  }

  .session-replaced {
    border-color: rgba(248, 113, 113, 0.65);
    background: rgba(69, 10, 10, 0.97);
    color: #fee2e2;
  }
</style>
