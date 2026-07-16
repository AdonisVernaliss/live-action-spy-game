<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    ACTIVITY_POINTS,
    localizeLocationName,
    parseLocationTemplate,
    readLocationTemplate,
    storeLocationTemplate,
    validateLocationTemplate,
    type ActivityPointName,
    type LocationTemplate,
  } from "$lib/locationSetup";
  import { language } from "$lib/i18n";
  import { wakeLockStatus } from "$lib/wakeLock";

  export let lobby: any;
  export let players: any[] = [];

  type PreflightMethod = "qr" | "nfc";
  type PreflightRow = {
    id: string;
    tag: string;
    label: string;
    room: string;
    group: "activity" | "player";
  };

  const dispatch = createEventDispatcher<{
    applyVenue: { activities: Record<string, { id: number; name: string; room: string }> };
    mark: { tag: string; method: PreflightMethod };
    clear: void;
  }>();

  let origin = "";
  let hostname = "";
  let importInput: HTMLInputElement;
  let message = "";
  let importError = "";
  const preflightMethods: PreflightMethod[] = ["qr", "nfc"];
  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  onMount(() => {
    origin = window.location.origin;
    hostname = window.location.hostname;
  });

  $: checks = lobby?.preflightChecks || {};
  $: realPlayers = players.filter(
    (player) => !player.isHostOnly && !player.isSimulated
  );
  $: connectedPlayers = realPlayers.filter(
    (player) => player.connection === "connected"
  );
  $: activityRows = ACTIVITY_POINTS.map((point) => ({
    id: point.name,
    tag: point.tag,
    label: $language === "en" ? point.labelEn : point.label,
    room: localizeLocationName(
      lobby?.activities?.[point.name]?.room || "",
      $language
    ),
    group: "activity" as const,
  }));
  $: playerRows = realPlayers.map((player) => ({
    id: `player-${player.color}`,
    tag: `player:${player.color}`,
    label: `${bi("Метка игрока", "Player tag")}: ${player.name}`,
    room: player.color,
    group: "player" as const,
  }));
  $: allRows = [...activityRows, ...playerRows] as PreflightRow[];
  $: qrChecked = allRows.filter((row) => checks[row.tag]?.qr != null).length;
  $: nfcChecked = allRows.filter((row) => checks[row.tag]?.nfc != null).length;
  $: activityQrChecked = activityRows.filter(
    (row) => checks[row.tag]?.qr != null
  ).length;
  $: missingRooms = activityRows.filter((row) => !row.room).length;
  $: secureOrigin =
    origin.startsWith("https://") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1";
  $: temporaryHostname = hostname.endsWith("trycloudflare.com");
  $: ready =
    allRows.length > 0 &&
    qrChecked === allRows.length &&
    missingRooms === 0 &&
    secureOrigin &&
    realPlayers.length > 0 &&
    connectedPlayers.length === realPlayers.length;

  function methodLabel(method: PreflightMethod) {
    return method === "qr" ? "QR" : "NFC";
  }

  function checkedAt(row: PreflightRow, method: PreflightMethod) {
    const value = checks[row.tag]?.[method]?.checkedAt;
    if (!value) return "";
    return new Date(value).toLocaleTimeString(
      $language === "en" ? "en-GB" : "ru-RU",
      { hour: "2-digit", minute: "2-digit" }
    );
  }

  function mark(row: PreflightRow, method: PreflightMethod) {
    if (checks[row.tag]?.[method] != null) return;
    dispatch("mark", { tag: row.tag, method });
  }

  function scanUrl(row: PreflightRow, method: PreflightMethod) {
    if (!origin) return "";
    return `${origin}/scan?tag=${encodeURIComponent(row.tag)}&source=${method}`;
  }

  async function copyScanUrl(row: PreflightRow, method: PreflightMethod) {
    try {
      await navigator.clipboard.writeText(scanUrl(row, method));
      message = bi(
        `${methodLabel(method)}-ссылка скопирована.`,
        `${methodLabel(method)} link copied.`
      );
      window.setTimeout(() => (message = ""), 1800);
    } catch {
      importError = bi(
        "Не удалось скопировать ссылку.",
        "Could not copy the link."
      );
    }
  }

  function openQrSheet() {
    window.open("/adminlinks?from=preflight", "_blank", "noopener");
  }

  function templateFromLobby(): LocationTemplate | null {
    if (lobby?.activities == null) return readLocationTemplate();
    const roomNames = [
      ...new Set(
        ACTIVITY_POINTS.map((point) => lobby.activities?.[point.name]?.room)
          .filter((room): room is string => typeof room === "string" && room.trim().length > 0)
          .map((room) => room.trim())
      ),
    ];
    const locations = roomNames.map((name, index) => ({
      id: `location-${index + 1}`,
      name,
    }));
    const assignments = Object.fromEntries(
      ACTIVITY_POINTS.map((point) => [
        point.name,
        locations.find(
          (location) => location.name === lobby.activities?.[point.name]?.room?.trim()
        )?.id || "",
      ])
    ) as Record<ActivityPointName, string>;

    return validateLocationTemplate({
      version: 2,
      name: `${bi("Площадка", "Venue")} ${lobby.creator}`,
      locations,
      assignments,
      rooms: {},
      savedAt: new Date().toISOString(),
    });
  }

  function exportVenue() {
    importError = "";
    const template = templateFromLobby();
    if (template == null) {
      importError = bi(
        "Сначала завершите настройку площадки.",
        "Complete venue setup first."
      );
      return;
    }

    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = template.name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/^-|-$/g, "") || "protocol-150-venue";
    anchor.href = url;
    anchor.download = `${safeName}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    message = bi("Площадка экспортирована.", "Venue exported.");
  }

  async function importVenue(event: Event) {
    importError = "";
    message = "";
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const template = parseLocationTemplate(await file.text());
    if (template == null || storeLocationTemplate(template) == null) {
      importError = bi(
        "Файл площадки повреждён или имеет неподдерживаемый формат.",
        "The venue file is invalid or uses an unsupported format."
      );
      return;
    }

    const activities = Object.fromEntries(
      ACTIVITY_POINTS.map((point) => [
        point.name,
        {
          id: point.id,
          name: point.name,
          room: template.rooms[point.name],
        },
      ])
    );

    if (lobby?.status?.state === "settingRooms") {
      dispatch("applyVenue", { activities });
      message = bi(
        "Площадка импортирована и применяется к текущему лобби.",
        "Venue imported and is being applied to the current lobby."
      );
    } else {
      message = bi(
        "Площадка сохранена для следующего лобби. Текущий матч не изменён.",
        "Venue saved for the next lobby. The current match was not changed."
      );
    }
  }

  function wakeLockLabel() {
    const labels = {
      active: ["активен", "active"],
      requesting: ["включается", "requesting"],
      inactive: ["ожидает активной игры", "waiting for an active game"],
      denied: ["требуется разрешение или касание экрана", "permission or screen interaction required"],
      unsupported: ["не поддерживается браузером", "not supported by this browser"],
    } as const;
    const [ru, en] = labels[$wakeLockStatus];
    return bi(ru, en);
  }
</script>

<section class="preflight-shell">
  <header class="preflight-header">
    <div>
      <p class="eyebrow">{bi("Перед запуском", "Before launch")}</p>
      <h2>{bi("Подготовка площадки", "Venue preflight")}</h2>
      <p>
        {bi(
          "Подключите игроков и пройдите все физические точки. Сканирование ссылок из листа автоматически отмечает QR или NFC.",
          "Connect the players and walk through every physical point. Scanning links from the sheet automatically records QR or NFC."
        )}
      </p>
    </div>
    <span class:ready class="readiness-badge">
      {ready ? bi("ГОТОВО", "READY") : bi("НУЖНА ПРОВЕРКА", "CHECK REQUIRED")}
    </span>
  </header>

  <div class="preflight-stats">
    <article><small>QR</small><strong>{qrChecked}/{allRows.length}</strong></article>
    <article><small>NFC</small><strong>{nfcChecked}/{allRows.length}</strong></article>
    <article><small>{bi("Игроки", "Players")}</small><strong>{connectedPlayers.length}/{realPlayers.length}</strong></article>
    <article><small>{bi("Локации", "Locations")}</small><strong>{missingRooms === 0 ? bi("готовы", "ready") : `−${missingRooms}`}</strong></article>
  </div>

  <section class="diagnostics-grid">
    <article class:warning={!secureOrigin}>
      <span>{bi("Адрес", "Origin")}</span>
      <strong>{origin || "…"}</strong>
      <small>{secureOrigin ? bi("HTTPS настроен", "HTTPS is ready") : bi("Для телефонов требуется HTTPS", "Phones require HTTPS")}</small>
    </article>
    <article class:warning={temporaryHostname}>
      <span>{bi("Hostname", "Hostname")}</span>
      <strong>{hostname || "…"}</strong>
      <small>{temporaryHostname ? bi("Временный Quick Tunnel — не печатайте финальные метки", "Temporary Quick Tunnel — do not print final tags") : bi("Адрес подходит для постоянных ссылок", "Origin is suitable for stable links")}</small>
    </article>
    <article class:warning={$wakeLockStatus === "unsupported" || $wakeLockStatus === "denied"}>
      <span>Wake Lock</span>
      <strong>{wakeLockLabel()}</strong>
      <small>{bi("Экран не должен уснуть во время игры", "The screen should stay awake during the game")}</small>
    </article>
  </section>

  <div class="venue-actions">
    <button class="primary" type="button" on:click={openQrSheet}>{bi("Открыть и распечатать QR/NFC", "Open and print QR/NFC")}</button>
    <button type="button" on:click={exportVenue}>{bi("Экспорт площадки", "Export venue")}</button>
    <button type="button" on:click={() => importInput.click()}>{bi("Импорт площадки", "Import venue")}</button>
    <button class="danger" type="button" on:click={() => dispatch("clear")}>{bi("Сбросить проверки", "Reset checks")}</button>
    <input bind:this={importInput} class="file-input" type="file" accept="application/json,.json" on:change={importVenue} />
  </div>

  {#if message}<p class="message">{message}</p>{/if}
  {#if importError}<p class="error">{importError}</p>{/if}

  {#if missingRooms > 0}
    <p class="warning-message">
      {bi(
        `Не назначены локации: ${missingRooms}. Импортируйте площадку или завершите настройку.`,
        `${missingRooms} locations are missing. Import a venue or complete setup.`
      )}
    </p>
  {/if}
  {#if realPlayers.some((player) => player.connection !== "connected")}
    <p class="warning-message">
      {bi("Есть отключённые игроки. Верните их в лобби перед стартом.", "Some players are offline. Return them to the lobby before starting.")}
    </p>
  {/if}

  <section class="check-section">
    <div class="section-heading">
      <div><p class="eyebrow">{bi("Физические точки", "Physical points")}</p><h3>{bi("Задания и защита", "Tasks and defense")}</h3></div>
      <span>{activityQrChecked}/{activityRows.length} QR</span>
    </div>
    <div class="check-list">
      {#each activityRows as row}
        <article class="check-row">
          <div class="point-main">
            <strong>{row.label}</strong>
            <small>{row.room || bi("Локация не назначена", "Location not assigned")}</small>
            <code>{row.tag}</code>
          </div>
          <div class="method-actions">
            {#each preflightMethods as method}
              <button
                type="button"
                class:checked={checks[row.tag]?.[method] != null}
                on:click={() => mark(row, method)}
              >
                <span>{method.toUpperCase()}</span>
                <small>{checkedAt(row, method) || bi("отметить", "mark")}</small>
              </button>
              <button class="copy" type="button" on:click={() => copyScanUrl(row, method)} aria-label={bi(`Копировать ${method.toUpperCase()}-ссылку`, `Copy ${method.toUpperCase()} link`)}>⧉</button>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="check-section">
    <div class="section-heading">
      <div><p class="eyebrow">{bi("Обязательное взаимодействие", "Required interaction")}</p><h3>{bi("Персональные метки игроков", "Player tags")}</h3></div>
      <span>{playerRows.length}</span>
    </div>
    {#if playerRows.length === 0}
      <p class="empty-note">{bi("Подключите реальных игроков — их персональные метки появятся здесь.", "Connect real players and their personal tags will appear here.")}</p>
    {:else}
      <div class="check-list">
        {#each playerRows as row}
          <article class="check-row">
            <div class="point-main"><strong>{row.label}</strong><small>{row.room}</small><code>{row.tag}</code></div>
            <div class="method-actions">
              {#each preflightMethods as method}
                <button type="button" class:checked={checks[row.tag]?.[method] != null} on:click={() => mark(row, method)}>
                  <span>{method.toUpperCase()}</span><small>{checkedAt(row, method) || bi("отметить", "mark")}</small>
                </button>
                <button class="copy" type="button" on:click={() => copyScanUrl(row, method)}>⧉</button>
              {/each}
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</section>

<style>
  .preflight-shell { min-width: 0; display: grid; gap: 14px; }
  .preflight-header,.check-section { padding: 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 20px; background: rgba(12,12,12,.96); }
  .preflight-header { display: flex; justify-content: space-between; gap: 18px; align-items: center; }
  .preflight-header h2,.section-heading h3 { margin: 3px 0; color: #fff; font-size: clamp(20px,4vw,28px); font-weight: 950; }
  .preflight-header p:not(.eyebrow) { max-width: 760px; margin: 7px 0 0; color: rgba(255,255,255,.58); line-height: 1.5; }
  .eyebrow { margin: 0; color: rgba(255,255,255,.45); font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .readiness-badge { flex: 0 0 auto; padding: 10px 13px; border: 1px solid rgba(251,191,36,.45); border-radius: 999px; color: #fde68a; background: rgba(146,64,14,.24); font-size: 11px; font-weight: 950; }
  .readiness-badge.ready { border-color: rgba(74,222,128,.55); color: #bbf7d0; background: rgba(22,101,52,.3); }
  .preflight-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 9px; }
  .preflight-stats article { min-width: 0; padding: 15px; border: 1px solid rgba(255,255,255,.09); border-radius: 15px; background: #0c0c0c; display: grid; gap: 5px; }
  .preflight-stats small,.diagnostics-grid span,.point-main small,.method-actions small,.section-heading>span,.empty-note { color: rgba(255,255,255,.5); }
  .preflight-stats strong { color: #86efac; font-size: clamp(18px,3vw,24px); overflow-wrap: anywhere; }
  .diagnostics-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 9px; }
  .diagnostics-grid article { min-width: 0; padding: 14px; border: 1px solid rgba(74,222,128,.22); border-radius: 15px; background: rgba(20,83,45,.12); display: grid; gap: 5px; }
  .diagnostics-grid article.warning { border-color: rgba(251,191,36,.35); background: rgba(120,53,15,.16); }
  .diagnostics-grid strong { overflow-wrap: anywhere; }
  .diagnostics-grid small { color: rgba(255,255,255,.5); line-height: 1.35; }
  .venue-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 42px; padding: 10px 13px; border: 1px solid rgba(34,197,94,.4); border-radius: 12px; background: rgba(34,197,94,.11); color: #fff; font-weight: 850; cursor: pointer; }
  button.primary { border-color: rgba(74,222,128,.7); background: #16a34a; }
  button.danger { border-color: rgba(248,113,113,.35); background: rgba(127,29,29,.2); }
  .file-input { display: none; }
  .message,.error,.warning-message { margin: 0; padding: 11px 13px; border-radius: 12px; font-weight: 750; }
  .message { color: #bbf7d0; background: rgba(20,83,45,.25); }
  .error,.warning-message { color: #fde68a; background: rgba(120,53,15,.25); }
  .section-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 13px; }
  .section-heading h3 { font-size: 19px; }
  .check-list { display: grid; gap: 7px; }
  .check-row { min-width: 0; padding: 11px; border: 1px solid rgba(255,255,255,.07); border-radius: 14px; background: rgba(255,255,255,.025); display: grid; grid-template-columns: minmax(180px,1fr) minmax(300px,auto); gap: 12px; align-items: center; }
  .point-main { min-width: 0; display: grid; gap: 3px; }
  .point-main strong,.point-main small,.point-main code { overflow-wrap: anywhere; }
  .point-main code { color: #86efac; font-size: 10px; }
  .method-actions { display: grid; grid-template-columns: minmax(82px,1fr) 38px minmax(82px,1fr) 38px; gap: 5px; }
  .method-actions>button:not(.copy) { display: grid; gap: 1px; text-align: left; }
  .method-actions button.checked { border-color: rgba(74,222,128,.7); background: rgba(22,101,52,.38); color: #bbf7d0; }
  .method-actions button.copy { padding: 8px; border-color: rgba(96,165,250,.3); background: rgba(30,64,175,.14); color: #bfdbfe; }
  .empty-note { margin: 0; line-height: 1.5; }
  @media(max-width:820px){.preflight-header{align-items:flex-start;flex-direction:column}.preflight-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.diagnostics-grid{grid-template-columns:1fr}.check-row{grid-template-columns:1fr}.method-actions{width:100%}}
  @media(max-width:520px){.preflight-header,.check-section{padding:14px;border-radius:17px}.venue-actions button{width:100%}.method-actions{grid-template-columns:minmax(72px,1fr) 36px minmax(72px,1fr) 36px}.method-actions>button:not(.copy){padding:8px}.section-heading{align-items:flex-start;flex-direction:column}}
</style>
