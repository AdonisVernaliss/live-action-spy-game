<script lang="ts">
  import { goto } from "$app/navigation";
  import { lobbyStore, notificationStore, playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";

  onMount(() => {
    if ($lobbyStore?.status.state == "meeting") gotoReplace("/vote");

    return lobbyStore.subscribe((lobby) => {
      if (lobby != null && lobby.status.state == "meeting") {
        if ($playerStore?.status === "alive") gotoReplace("/vote");
        else gotoReplace("/dead");
      }
    });
  });
</script>

<div>
  <p>{$t("meeting.waiting")}</p>
</div>
