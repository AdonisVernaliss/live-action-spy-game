<!-- This page is only for testing the NFC tag scanner on an actual mobile device. It is not used in-game. -->

<script>
  import ScanButton from "$lib/ScanButton.svelte";
  import { language } from "$lib/i18n";
  let msg = "";
</script>

<div class="mt-20">
  <ScanButton on:scanned={({ detail }) => (msg = detail.result)}>
    {$language === "en" ? "Scan" : "Сканировать"}</ScanButton
  >
</div>

<div class="text-2xl">
  {msg}
</div>
