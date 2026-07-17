<script lang="ts">
  export let notificationMessage: string | null;
</script>

{#if notificationMessage !== null}
  <div
    class="notification-bar bg-green-900 text-green-50 font-bold text-sm text-center"
    role="status"
    aria-live="polite"
  >
    <p>
      {notificationMessage}
    </p>
  </div>
{/if}

<style>
  .notification-bar {
    width: 100%;
    height: var(--notification-height);
    min-height: var(--notification-height);
    flex: 0 0 auto;
    padding:
      var(--safe-top)
      max(104px, calc(var(--safe-right) + 94px))
      0
      max(8px, var(--safe-left));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-size: clamp(10px, 2.8vw, 14px);
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .notification-bar p {
    margin: 0;
  }

</style>
