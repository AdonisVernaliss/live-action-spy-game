<script lang="ts">
  export let disabled = false;
</script>

<button
  on:click
  class="main-button border border-green-600 disabled:text-gray-400 w-full"
  {disabled}
>
  <slot /></button
>

<style>
  .main-button {
    min-height: 52px;
    max-width: 18rem;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: clamp(15px, 4vw, 18px);
    line-height: 1.2;
    font-weight: 800;
    overflow-wrap: anywhere;
  }
</style>
