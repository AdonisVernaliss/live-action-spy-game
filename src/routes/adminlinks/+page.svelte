<script lang="ts">
  import { onMount } from "svelte";
  import QrCard from "./QrCard.svelte";
  import { ACTIVITY_POINTS, readLocationTemplate, type LocationTemplate } from "$lib/locationSetup";
  import { language } from "$lib/i18n";

  let baseUrl = "";
  let template: LocationTemplate | null = null;
  const bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  onMount(() => {
    baseUrl = window.location.origin;
    template = readLocationTemplate();
  });

  const players = [
    "green",
    "blue",
    "yellow",
    "pink",
    "red",
    "orange",
    "purple",
    "black",
    "white",
    "cyan",
    "lime",
    "brown",
    "gray",
    "navy",
    "maroon",
  ];

  function printPage() {
    window.print();
  }
</script>

<main class="admin-page">
  <section class="header-card">
    <p class="eyebrow">{bi("Протокол 150", "Protocol 150")}</p>

    <h1>{bi("Лист QR/NFC", "QR/NFC sheet")}</h1>

    <p class="description">
      {bi(
        "Распечатайте или скопируйте ссылки для текущего адреса. QR-коды создаются прямо в браузере. Запишите показанный URL на NFC как URL-запись — NFC и QR будут открывать один и тот же экран. QR остаётся резервным вариантом.",
        "Print or copy the links for the current address. QR codes are created directly in the browser. Write the displayed URL to NFC as a URL record: NFC and QR will open the same screen, with QR as the fallback."
      )}
    </p>

    {#if template}
      <p class="template-label">{bi("Площадка", "Venue")}: <strong>{template.name}</strong></p>
    {/if}

    <div class="base-box">
      <span>{bi("Текущий базовый URL", "Current base URL")}</span>
      <code>{baseUrl || "loading..."}</code>
    </div>

    <button type="button" class="print-button" on:click={printPage}>
      {bi("Распечатать лист", "Print sheet")}
    </button>
  </section>

  {#each ["Основное", "Задания", "Защита"] as group}
    <section class="section">
      <h2>{ACTIVITY_POINTS.find((point) => point.group === group)?.[$language === "en" ? "groupEn" : "group"] || group}</h2>
      <div class="grid">
        {#each ACTIVITY_POINTS.filter((point) => point.group === group) as point}
          <QrCard
            label={`${point.id}. ${$language === "en" ? point.labelEn : point.label}`}
            tag={point.tag}
            location={template?.rooms[point.name] || ""}
            {baseUrl}
          />
        {/each}
      </div>
    </section>
  {/each}

  <section class="section">
    <h2>{bi("Секретное задание", "Secret task")}</h2>
    <div class="grid">
      <QrCard label={bi("Секретное переопределение системы", "Secret system override")} tag="task:secret" {baseUrl} />
    </div>
  </section>

  <section class="section">
    <h2>{bi("Метки игроков", "Player tags")}</h2>

    <div class="grid">
      {#each players as color}
        <QrCard label={`${bi("Игрок", "Player")}: ${color}`} tag={`player:${color}`} {baseUrl} />
      {/each}
    </div>
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .admin-page {
    min-height: var(--app-height);
    width: 100%;
    padding: 24px;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 34rem),
      #000;
    color: white;
  }

  .header-card {
    max-width: 980px;
    margin: 0 auto 24px;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(8, 8, 8, 0.94);
  }

  .eyebrow {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 8px 0 14px;
    font-size: 34px;
    line-height: 1.1;
    font-weight: 900;
  }

  h2 {
    max-width: 980px;
    margin: 28px auto 14px;
    font-size: 24px;
    font-weight: 900;
  }

  .description {
    margin: 0 0 18px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 15px;
    line-height: 1.45;
  }

  .base-box {
    padding: 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .template-label {
    margin: 14px 0 0;
    color: #86efac;
  }

  .base-box span {
    display: block;
    color: rgba(255, 255, 255, 0.52);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  code {
    display: block;
    margin-top: 6px;
    color: #86efac;
    overflow-wrap: anywhere;
  }

  .print-button {
    margin-top: 18px;
    padding: 14px 18px;
    border-radius: 16px;
    border: 1px solid rgba(34, 197, 94, 0.55);
    background: rgba(34, 197, 94, 0.16);
    color: white;
    font-weight: 900;
  }

  .section {
    max-width: 980px;
    margin: 0 auto;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  @media print {
    :global(body) {
      background: white;
    }

    .admin-page {
      background: white;
      color: black;
      padding: 0;
    }

    .header-card,
    .section {
      max-width: none;
    }

    .header-card {
      border: none;
      background: white;
      padding: 12px;
      margin-bottom: 8px;
    }

    .description,
    .base-box,
    .print-button {
      display: none;
    }

    h1 {
      color: black;
      font-size: 24px;
    }

    h2 {
      color: black;
      margin: 16px 0 8px;
      font-size: 18px;
      break-after: avoid;
    }

    .grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
  }
</style>
