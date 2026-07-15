<script lang="ts">
  import QRCode from "qrcode";
  import { t } from "$lib/i18n";

  export let link: string;

  const bgColor = 0x1b5c04;

  let canvas: HTMLCanvasElement | null = null;
  let windowWidth = 0;
  let renderId = 0;

  $: if (canvas != null && link && windowWidth > 0) {
    renderQRCode(link, windowWidth);
  }

  async function renderQRCode(currentLink: string, currentWindowWidth: number) {
    const currentRenderId = ++renderId;

    if (canvas == null) return;

    const size = Math.max(160, Math.min(260, Math.floor(currentWindowWidth / 3)));

    await QRCode.toCanvas(canvas, currentLink, {
      width: size,
      margin: 2,
    });

    if (currentRenderId !== renderId) return;
    if (canvas == null) return;

    const ctx = canvas.getContext("2d");
    if (ctx == null) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < imageData.height * imageData.width * 4; i += 4) {
      const r0 = imageData.data[i];
      const g0 = imageData.data[i + 1];
      const b0 = imageData.data[i + 2];

      if (r0 + g0 + b0 !== 0) {
        const r = bgColor & 0xff;
        const g = (bgColor >> 8) & 0xff;
        const b = (bgColor >> 16) & 0xff;

        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="qr-box">
  {#if link}
    <canvas bind:this={canvas} class="qr-canvas" />
    <p>{$t("qr.join")}</p>
  {:else}
    <div class="qr-placeholder">{$t("qr.loading")}</div>
  {/if}
</div>

<style>
  .qr-box {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .qr-canvas {
    display: block;
    padding: 4px;
    margin-bottom: 8px;
    background: white;
    border-radius: 12px;
  }

  .qr-box p {
    margin: 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    text-align: center;
  }

  .qr-placeholder {
    width: 180px;
    height: 180px;
    border-radius: 14px;
    border: 1px dashed rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.55);
    font-size: 13px;
    text-align: center;
  }
</style>
