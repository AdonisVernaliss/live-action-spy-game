<script lang="ts">
  import { dev } from "$lib/consts";
  import MainButton from "$lib/MainButton.svelte";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction } from "$lib/websocket";
  import { t } from "$lib/i18n";

  function callMeeting() {
    emitGameAction({ action: "callMeeting" });
  }

  function gobackHandler() {
    gotoReplace("/game");
  }
</script>

{#if $lobbyStore != null && $lobbyStore.status.state === "started"}
  <div class="h-full flex flex-col justify-between flex-1 p-10 items-center">
    <div></div>
    <div>
      <div class="flex flex-col items-center">
        <p>
          {$lobbyStore.status.countDown > 0
            ? $t("meetingButton.left", { seconds: $lobbyStore.status.countDown })
            : $t("meetingButton.ready")}
        </p>
        <MainButton
          disabled={$lobbyStore.status.countDown > 0 && !dev}
          on:click={callMeeting}
          >{$t("meetingButton.call")}
          {#if dev}
            <div class="text-xs text-gray-400">
              (Dev mode: Can always click)
            </div>
          {/if}
        </MainButton>
      </div>
      <p>{$t("meetingButton.remaining", { count: $playerStore?.emergencyMeetingsLeft })}</p>
    </div>
    <div>
      <button class="border-gray-400 border px-8 py-4" on:click={gobackHandler}
        >{$t("meetingButton.back")}</button
      >
    </div>
  </div>
{/if}
