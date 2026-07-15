<script lang="ts">
  import { t } from "$lib/i18n";

  export let playerName: string;
</script>

<div>
  <label for="nameInput" class="block">{$t("name.label")}</label>
  <input
    id="nameInput"
    type="text"
    maxlength="20"
    autocomplete="nickname"
    placeholder={$t("name.placeholder")}
    bind:value={playerName}
    class="text-black px-2 py-3 mt-1"
  />
</div>
