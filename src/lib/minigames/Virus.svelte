<script lang="ts">
  import message from "$lib/minigames/images/message.png";
  import virus from "$lib/minigames/images/virus.png";
  import { gotoReplace } from "$lib/util";
  import { language } from "$lib/i18n";
  import { onDestroy, onMount } from "svelte";

  type ThreatKind = "normal" | "fast" | "armored" | "stealth";
  type ToolKind = "quarantine" | "breaker";
  type Threat = {
    id: number;
    cell: number;
    kind: ThreatKind;
    hitsRemaining: number;
    spawnedAt: number;
    expiresAt: number;
    nextMoveAt: number;
    movesRemaining: number;
  };

  const CELL_COUNT = 12;
  const TARGET_SCORE = 22;
  const MAX_BREACHES = 4;
  const GAME_TIME = 65;

  let threats: Threat[] = [];
  let threatByCell = new Map<number, Threat>();
  let quarantined = 0;
  let breaches = 0;
  let falsePositives = 0;
  let combo = 0;
  let selectedTool: ToolKind = "quarantine";
  let timeLeft = GAME_TIME;
  let now = Date.now();
  let deadline = 0;
  let nextThreatId = 1;
  let active = false;
  let failed = false;
  let feedback = "";
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let spawnTimer: ReturnType<typeof setTimeout> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;

  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  $: threatByCell = new Map(threats.map((threat) => [threat.cell, threat]));

  onMount(startGame);
  onDestroy(cleanup);

  function startGame() {
    cleanup();
    threats = [];
    quarantined = 0;
    breaches = 0;
    falsePositives = 0;
    combo = 0;
    selectedTool = "quarantine";
    timeLeft = GAME_TIME;
    now = Date.now();
    deadline = now + GAME_TIME * 1000;
    nextThreatId = 1;
    active = true;
    failed = false;
    feedback = bi("Сканирование запущено", "Scan started");
    tickTimer = setInterval(tick, 80);
    scheduleThreat(350);
  }

  function cleanup() {
    if (tickTimer) clearInterval(tickTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    if (finishTimer) clearTimeout(finishTimer);
    tickTimer = null;
    spawnTimer = null;
    finishTimer = null;
  }

  function tick() {
    if (!active) return;
    now = Date.now();
    timeLeft = Math.max(0, Math.ceil((deadline - now) / 1000));

    const expired = threats.filter((threat) => threat.expiresAt <= now);
    if (expired.length > 0) {
      threats = threats.filter((threat) => threat.expiresAt > now);
      breaches += expired.length;
      combo = 0;
      feedback = bi("Вирус прорвался через узел", "A virus breached a node");
    }

    relocateThreats();

    if (breaches >= MAX_BREACHES || timeLeft <= 0) failGame();
  }

  function scheduleThreat(delay = 500 + Math.random() * 320) {
    if (spawnTimer) clearTimeout(spawnTimer);
    spawnTimer = setTimeout(() => {
      spawnTimer = null;
      spawnThreat();
      if (active) scheduleThreat();
    }, delay);
  }

  function spawnThreat() {
    if (!active) return;
    const maxActive = quarantined < 6 ? 3 : 4;
    if (threats.length >= maxActive) return;

    const occupied = new Set(threats.map((threat) => threat.cell));
    const freeCells = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
      (cell) => !occupied.has(cell)
    );
    if (freeCells.length === 0) return;

    const roll = Math.random();
    const kind: ThreatKind =
      quarantined >= 7 && roll < 0.18
        ? "stealth"
        : quarantined >= 3 && roll < 0.43
          ? "fast"
          : quarantined >= 5 && roll > 0.76
            ? "armored"
            : "normal";
    const lifetime =
      kind === "fast"
        ? 1550
        : kind === "armored"
          ? 3500
          : kind === "stealth"
            ? 3200
            : 2300;
    const spawnedAt = Date.now();

    threats = [
      ...threats,
      {
        id: nextThreatId++,
        cell: freeCells[Math.floor(Math.random() * freeCells.length)],
        kind,
        hitsRemaining: 1,
        spawnedAt,
        expiresAt: spawnedAt + lifetime,
        nextMoveAt:
          kind === "fast"
            ? spawnedAt + 600
            : kind === "stealth"
              ? spawnedAt + 760
              : Number.POSITIVE_INFINITY,
        movesRemaining: kind === "stealth" ? 2 : kind === "fast" ? 1 : 0,
      },
    ];
  }

  function relocateThreats() {
    const occupied = new Set(threats.map((threat) => threat.cell));
    let changed = false;
    const relocated = threats.map((threat) => {
      if (threat.movesRemaining <= 0 || threat.nextMoveAt > now) return threat;

      occupied.delete(threat.cell);
      const freeCells = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
        (cell) => !occupied.has(cell)
      );
      if (freeCells.length === 0) {
        occupied.add(threat.cell);
        return { ...threat, nextMoveAt: now + 180 };
      }

      const nextCell = freeCells[Math.floor(Math.random() * freeCells.length)];
      occupied.add(nextCell);
      changed = true;
      return {
        ...threat,
        cell: nextCell,
        movesRemaining: threat.movesRemaining - 1,
        nextMoveAt:
          threat.movesRemaining > 1
            ? now + 720
            : Number.POSITIVE_INFINITY,
      };
    });

    if (changed) threats = relocated;
  }

  function scanCell(event: PointerEvent, cell: number) {
    event.preventDefault();
    if (!active) return;

    const threat = threats.find((candidate) => candidate.cell === cell);
    if (!threat) {
      applyMistake(
        bi("Повреждён обычный файл: −1 очко", "Normal file damaged: −1 point")
      );
      return;
    }

    const correctTool = threat.kind === "armored" ? "breaker" : "quarantine";
    if (selectedTool !== correctTool) {
      applyMistake(
        threat.kind === "armored"
          ? bi("Нужен пробой брони: −1 очко", "Armor breaker required: −1 point")
          : bi("Нужен карантин: −1 очко", "Quarantine required: −1 point")
      );
      return;
    }

    threats = threats.filter((candidate) => candidate.id !== threat.id);
    quarantined += 1;
    combo += 1;
    feedback = combo >= 3
      ? bi(`Серия x${combo}`, `Combo x${combo}`)
      : bi("Угроза изолирована", "Threat quarantined");

    if (quarantined >= TARGET_SCORE) winGame();
  }

  function applyMistake(text: string) {
    falsePositives += 1;
    quarantined = Math.max(0, quarantined - 1);
    combo = 0;
    feedback = text;
  }

  function threatLife(threat: Threat) {
    const duration = threat.expiresAt - threat.spawnedAt;
    return Math.max(0, Math.min(100, ((threat.expiresAt - now) / duration) * 100));
  }

  function kindLabel(kind: ThreatKind) {
    if (kind === "fast") return bi("БЫСТРЫЙ", "FAST");
    if (kind === "armored") return bi("БРОНЯ", "ARMORED");
    if (kind === "stealth") return bi("СКРЫТЫЙ", "STEALTH");
    return bi("ВИРУС", "VIRUS");
  }

  function isThreatVisible(threat: Threat) {
    if (threat.kind !== "stealth") return true;
    return (now - threat.spawnedAt) % 850 < 360;
  }

  function winGame() {
    if (!active) return;
    active = false;
    cleanup();
    feedback = bi("Сеть очищена", "Network cleaned");
    finishTimer = setTimeout(() => gotoReplace("/minigamedone"), 750);
  }

  function failGame() {
    if (!active) return;
    active = false;
    failed = true;
    if (tickTimer) clearInterval(tickTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    tickTimer = null;
    spawnTimer = null;
  }
</script>

<main class="virus-page">
  <section class="terminal">
    <p class="eyebrow">{bi("Антивирусный терминал", "Antivirus terminal")}</p>
    <h1>{bi("Карантин сети", "Network quarantine")}</h1>
    <p class="description">
      {bi(
        "Выберите инструмент и удаляйте вирусы до истечения шкалы. Карантин действует на обычные, быстрые и скрытые угрозы; пробой брони — только на защищённые. Обычные файлы не трогайте.",
        "Choose a tool and remove viruses before their meter expires. Quarantine handles normal, fast, and stealth threats; armor breaker handles armored threats only. Leave normal files alone."
      )}
    </p>

    <div class="stats">
      <div><small>{bi("Карантин", "Quarantine")}</small><strong>{quarantined}/{TARGET_SCORE}</strong></div>
      <div><small>{bi("Прорывы", "Breaches")}</small><strong class:danger={breaches > 0}>{breaches}/{MAX_BREACHES}</strong></div>
      <div><small>{bi("Ошибки", "Mistakes")}</small><strong>{falsePositives}</strong></div>
      <div><small>{bi("Время", "Time")}</small><strong>{timeLeft}s</strong></div>
    </div>

    <div class="tool-selector" role="group" aria-label={bi("Инструмент", "Tool")}>
      <button
        type="button"
        class:active={selectedTool === "quarantine"}
        on:click={() => (selectedTool = "quarantine")}
      >
        <b>▣</b>
        <span>{bi("Карантин", "Quarantine")}</span>
        <small>{bi("вирус / быстрый / скрытый", "normal / fast / stealth")}</small>
      </button>
      <button
        type="button"
        class:active={selectedTool === "breaker"}
        on:click={() => (selectedTool = "breaker")}
      >
        <b>◆</b>
        <span>{bi("Пробой брони", "Armor breaker")}</span>
        <small>{bi("только броня", "armored only")}</small>
      </button>
    </div>

    <div class="scan-grid">
      {#each Array(CELL_COUNT) as _, cell}
        {@const threat = threatByCell.get(cell)}
        {@const cloaked = threat?.kind === "stealth" && !isThreatVisible(threat)}
        <button
          type="button"
          class="node"
          class:infected={threat != null && !cloaked}
          class:fast={threat?.kind === "fast"}
          class:armored={threat?.kind === "armored"}
          class:stealth={threat?.kind === "stealth"}
          class:cloaked
          aria-label={threat
            ? `${kindLabel(threat.kind)} ${cell + 1}`
            : bi(`Обычный файл ${cell + 1}`, `Normal file ${cell + 1}`)}
          on:pointerdown={(event) => scanCell(event, cell)}
        >
          <span class="node-id">N-{String(cell + 1).padStart(2, "0")}</span>
          <img
            src={threat && !cloaked ? virus : message}
            alt=""
            draggable="false"
          />
          {#if threat && !cloaked}
            <b class="kind">{kindLabel(threat.kind)}</b>
            {#if threat.kind === "armored"}<i class="shield">◆</i>{/if}
            <span class="life"><i style={`width:${threatLife(threat)}%`}></i></span>
          {:else}
            <b class="safe">{bi("ФАЙЛ", "FILE")}</b>
          {/if}
        </button>
      {/each}
    </div>

    <div class="footer-status">
      <span>{feedback}</span>
      <strong>{bi("Серия", "Combo")} x{combo}</strong>
    </div>

    {#if failed}
      <div class="overlay">
        <strong>{timeLeft <= 0 ? bi("Время истекло", "Time expired") : bi("Сеть заражена", "Network infected")}</strong>
        <span>{bi("Перезапустите сканирование и реагируйте на тип угрозы.", "Restart the scan and react to each threat type.")}</span>
        <button type="button" on:click={startGame}>{bi("Новый скан", "New scan")}</button>
      </div>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    overflow: hidden;
    background: #020403;
  }

  .virus-page {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding:
      10px
      max(12px, var(--safe-right))
      max(12px, var(--safe-bottom))
      max(12px, var(--safe-left));
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    background: radial-gradient(circle at 50% 0, rgba(34, 197, 94, 0.16), transparent 30rem), #020403;
    color: white;
  }

  .terminal {
    position: relative;
    flex: 0 0 auto;
    min-width: 0;
    width: min(620px, 100%);
    margin: auto 0;
    padding: clamp(15px, 4vw, 23px);
    border: 1px solid rgba(74, 222, 128, 0.24);
    border-radius: 24px;
    background: rgba(4, 9, 6, 0.97);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
  }

  .eyebrow,
  small {
    margin: 0;
    color: #86efac;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    margin: 6px 0 8px;
    font-size: clamp(27px, 7vw, 41px);
    font-weight: 950;
    line-height: 1;
  }

  .description {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    line-height: 1.4;
  }

  .stats {
    margin: 13px 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .stats div {
    min-width: 0;
    padding: 8px;
    display: grid;
    gap: 3px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
  }

  .stats strong {
    font-size: 16px;
  }

  .stats .danger {
    color: #f87171;
  }

  .scan-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(5px, 1.7vw, 9px);
  }

  .tool-selector {
    margin: 0 0 9px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .tool-selector button {
    min-width: 0;
    padding: 8px 10px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1px 7px;
    align-items: center;
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.035);
    color: rgba(255, 255, 255, 0.7);
    text-align: left;
  }

  .tool-selector button.active {
    border-color: #4ade80;
    background: rgba(22, 101, 52, 0.35);
    color: white;
  }

  .tool-selector button > b {
    grid-row: 1 / 3;
    color: #86efac;
    font-size: 18px;
  }

  .tool-selector button > span {
    min-width: 0;
    font-size: 11px;
    font-weight: 900;
  }

  .tool-selector button > small {
    min-width: 0;
    overflow-wrap: anywhere;
    color: rgba(255, 255, 255, 0.42);
    font-size: 7px;
  }

  .node {
    position: relative;
    min-width: 0;
    aspect-ratio: 1.08;
    padding: 14px 4px 8px;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 13px;
    overflow: hidden;
    background: #07100b;
    color: white;
    touch-action: manipulation;
  }

  .node img {
    width: clamp(34px, 10vw, 54px);
    height: clamp(34px, 10vw, 54px);
    object-fit: contain;
    image-rendering: pixelated;
    opacity: 0.26;
    filter: grayscale(0.8);
    pointer-events: none;
    user-select: none;
  }

  .node-id {
    position: absolute;
    top: 5px;
    left: 7px;
    color: rgba(255, 255, 255, 0.32);
    font-size: 8px;
    font-weight: 900;
  }

  .safe,
  .kind {
    position: absolute;
    right: 5px;
    bottom: 5px;
    left: 5px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 8px;
    letter-spacing: 0.06em;
  }

  .node.infected {
    border-color: rgba(248, 113, 113, 0.78);
    background: radial-gradient(circle, rgba(127, 29, 29, 0.5), #130706);
    animation: infected-pulse 0.55s alternate infinite;
  }

  .node.infected img {
    opacity: 1;
    filter: none;
  }

  .node.fast {
    border-color: #facc15;
    animation-duration: 0.18s;
  }

  .node.armored {
    border-color: #60a5fa;
    background: radial-gradient(circle, rgba(30, 64, 175, 0.55), #070b16);
  }

  .node.stealth {
    border-color: #c084fc;
    background: radial-gradient(circle, rgba(88, 28, 135, 0.55), #100719);
  }

  .node.cloaked {
    border-color: rgba(192, 132, 252, 0.18);
    background: #07100b;
    animation: stealth-glitch 0.42s steps(2, end) infinite;
  }

  .node.cloaked img {
    opacity: 0.21;
    filter: grayscale(0.8);
  }

  .kind {
    color: #fecaca;
  }

  .fast .kind {
    color: #fde68a;
  }

  .armored .kind {
    color: #bfdbfe;
  }

  .stealth .kind {
    color: #e9d5ff;
  }

  .shield {
    position: absolute;
    top: 5px;
    right: 6px;
    color: #bfdbfe;
    font-size: 10px;
    font-style: normal;
    font-weight: 950;
  }

  .life {
    position: absolute;
    right: 5px;
    bottom: 2px;
    left: 5px;
    height: 3px;
    border-radius: 5px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.12);
  }

  .life i {
    display: block;
    height: 100%;
    background: #f87171;
  }

  .fast .life i {
    background: #facc15;
  }

  .armored .life i {
    background: #60a5fa;
  }

  .stealth .life i {
    background: #c084fc;
  }

  .footer-status {
    min-height: 34px;
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
  }

  .footer-status strong {
    flex: 0 0 auto;
    color: #86efac;
  }

  .overlay {
    position: absolute;
    inset: 0;
    z-index: 4;
    padding: 22px;
    display: grid;
    place-content: center;
    gap: 11px;
    border-radius: 24px;
    background: rgba(0, 0, 0, 0.92);
    text-align: center;
  }

  .overlay strong {
    font-size: 24px;
  }

  .overlay span {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
  }

  .overlay button {
    padding: 14px;
    border: 1px solid #4ade80;
    border-radius: 12px;
    background: #166534;
    color: white;
    font-weight: 900;
  }

  @keyframes infected-pulse {
    to { box-shadow: inset 0 0 20px rgba(239, 68, 68, 0.28); }
  }

  @keyframes stealth-glitch {
    50% { border-color: rgba(192, 132, 252, 0.34); }
  }

  @media (max-width: 430px) {
    .terminal { padding: 13px; }
    .stats div { padding: 6px; }
    .stats small { font-size: 8px; }
    .stats strong { font-size: 14px; }
    .node { border-radius: 10px; }
  }

  @media (max-height: 700px) {
    .description { display: none; }
    .stats { margin: 8px 0; }
    .terminal { padding-top: 13px; padding-bottom: 10px; }
    .footer-status { min-height: 24px; margin-top: 5px; }
    .tool-selector button { padding-top: 5px; padding-bottom: 5px; }
  }
</style>
