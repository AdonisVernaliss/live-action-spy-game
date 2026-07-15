<script lang="ts">
  import { dev } from "$lib/consts";
  import { language } from "$lib/i18n";

  export let disabled = false;
</script>

<button
  disabled={disabled && !dev}
  on:click
  class="border leading-4 px-1 py-1 text-md border-green-600 w-1/2 disabled:text-gray-400"
>
  <slot />
  {#if dev}
    <br /><span class="text-xs text-gray-400">{$language === "en" ? "Development mode: no waiting" : "Режим разработки: без ожидания"}</span>
  {/if}</button
>
