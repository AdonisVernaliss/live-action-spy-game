<script lang="ts">
  import QRCode from "qrcode";
  import { language } from "$lib/i18n";

  export let label: string;
  export let tag: string;
  export let baseUrl: string;
  export let location = "";

  let canvas: HTMLCanvasElement;

  $: scanUrl = baseUrl
    ? `${baseUrl}/scan?tag=${encodeURIComponent(tag)}`
    : "";

  $: if (canvas && scanUrl) {
    QRCode.toCanvas(canvas, scanUrl, { width: 220, margin: 2 });
  }

  async function copyLink() {
    if (!scanUrl) return;
    await navigator.clipboard.writeText(scanUrl);
  }
</script>

<article class="qr-card">
  <h3>{label}</h3>

  <p class="tag">{tag}</p>

  {#if location}<p class="location">{location}</p>{/if}

  <canvas bind:this={canvas} aria-label={`${$language === "en" ? "QR code" : "QR-код"}: ${label}`} />

  <code>{scanUrl}</code>

  <button type="button" on:click={copyLink}>
    {$language === "en" ? "Copy link" : "Копировать ссылку"}
  </button>
</article>

<style>
  .qr-card {
    padding: 16px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.055);
    color: white;
    break-inside: avoid;
  }

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 900;
  }

  .tag {
    margin: 6px 0 12px;
    color: #86efac;
    font-size: 13px;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .location {
    min-height: 38px;
    margin: -6px 0 10px;
    color: white;
    font-size: 15px;
    font-weight: 900;
  }

  canvas {
    width: 100%;
    max-width: 220px;
    aspect-ratio: 1;
    display: block;
    margin: 0 auto 12px;
    border-radius: 12px;
    background: white;
  }

  code {
    display: block;
    min-height: 44px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 11px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  button {
    width: 100%;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(34, 197, 94, 0.55);
    background: rgba(34, 197, 94, 0.14);
    color: white;
    font-weight: 900;
  }

  @media print {
    .qr-card {
      border: 1px solid #ddd;
      background: white;
      color: black;
      padding: 10px;
    }

    h3 {
      color: black;
      font-size: 14px;
    }

    .tag {
      color: #111;
      font-size: 11px;
    }

    canvas {
      max-width: 150px;
    }

    code,
    button {
      display: none;
    }
  }
</style>
