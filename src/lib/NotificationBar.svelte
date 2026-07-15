<script lang="ts">
  export let notificationMessage: string | null;
</script>

{#if notificationMessage !== null}
  <div
    class="notification-bar w-full bg-green-900 text-green-50 min-h-14 px-2 py-2 font-bold
    text-sm flex flex-col justify-center items-center text-center"
  >
    <p>
      {notificationMessage}
    </p>
  </div>
{/if}

<style>
  .notification-bar {
    flex: 0 0 auto;
    padding-left: max(8px, var(--safe-left));
    padding-right: max(8px, var(--safe-right));
  }
</style>
