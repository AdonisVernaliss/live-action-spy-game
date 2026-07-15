<script lang="ts">
  import { t } from "$lib/i18n";

  export let taskProgress = 50;
</script>

<div class="flex flex-col space-y-1 items-center">
  <label for="taskbar" class="text-lg"
    >{$t("taskbar.label")} <span class="text-xs text-gray-400"
      >{$t("taskbar.delay")}</span
    ></label
  >
  <progress
    id="taskbar"
    class="border border-gray-600 w-full"
    value={taskProgress}
    max="100"
  />
</div>

<style>
  #taskbar::-webkit-progress-value {
    background-color: rgb(21, 128, 61);
  }

  #taskbar::-webkit-progress-bar {
    background-color: #000;
  }

  #taskbar::-moz-progress-bar {
    background-color: rgb(21, 128, 61);
  }
</style>
