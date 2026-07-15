<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { onDestroy, onMount } from "svelte";
  import { language } from "$lib/i18n";

  const GRID_SIZE = 6;
  const CELL_COUNT = GRID_SIZE * GRID_SIZE;
  const GAME_TIME = 75;
  const N = 1;
  const E = 2;
  const S = 4;
  const W = 8;
  const DECOY_MASKS = [N | S, E | W, N | E, E | S, S | W, W | N, N | E | S, E | S | W];

  let connectors: number[] = [];
  let rotations: number[] = [];
  let routePath: number[] = [];
  let powered = new Set<number>();
  let sourceRow = 0;
  let sinkRow = 0;
  let sinkCell = 0;
  let moves = 0;
  let timeLeft = GAME_TIME;
  let timer: ReturnType<typeof setInterval> | null = null;
  let failed = false;
  let won = false;
  const bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  onMount(startGame);
  onDestroy(stopTimer);

  function randomInt(max: number) {
    return Math.floor(Math.random() * max);
  }

  function cellIndex(row: number, column: number) {
    return row * GRID_SIZE + column;
  }

  function createRoute() {
    const rows = Array.from({ length: GRID_SIZE }, () => randomInt(GRID_SIZE));
    const path = [cellIndex(rows[0], 0)];
    let currentRow = rows[0];

    for (let column = 0; column < GRID_SIZE - 1; column += 1) {
      const nextRow = rows[column + 1];
      while (currentRow !== nextRow) {
        currentRow += currentRow < nextRow ? 1 : -1;
        path.push(cellIndex(currentRow, column));
      }
      path.push(cellIndex(currentRow, column + 1));
    }

    sourceRow = rows[0];
    sinkRow = rows[GRID_SIZE - 1];
    return path;
  }

  function buildRoute() {
    let path = createRoute();
    for (let attempt = 0; attempt < 40 && path.length < 15; attempt += 1) {
      path = createRoute();
    }
    return path;
  }

  function startGame() {
    stopTimer();
    routePath = buildRoute();
    sinkCell = routePath[routePath.length - 1];
    connectors = Array.from(
      { length: CELL_COUNT },
      () => DECOY_MASKS[randomInt(DECOY_MASKS.length)]
    );

    routePath.forEach((cell, routeIndex) => {
      let mask = 0;
      mask |= routeIndex === 0
        ? W
        : directionBetween(cell, routePath[routeIndex - 1]);
      mask |= routeIndex === routePath.length - 1
        ? E
        : directionBetween(cell, routePath[routeIndex + 1]);
      connectors[cell] = mask;
    });

    const solutionCells = new Set(routePath);
    rotations = connectors.map((mask, cell) => {
      if (!solutionCells.has(cell)) return randomInt(4);
      const incorrectTurns = [0, 1, 2, 3].filter(
        (turns) => rotateMask(mask, turns) !== mask
      );
      return incorrectTurns[randomInt(incorrectTurns.length)];
    });

    moves = 0;
    timeLeft = GAME_TIME;
    failed = false;
    won = false;
    updatePower();
    timer = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        failed = true;
        stopTimer();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function directionBetween(from: number, to: number) {
    if (to === from - GRID_SIZE) return N;
    if (to === from + 1) return E;
    if (to === from + GRID_SIZE) return S;
    return W;
  }

  function rotateMask(mask: number, turns: number) {
    let result = mask;
    for (let index = 0; index < turns % 4; index += 1) {
      result = ((result << 1) & 15) | ((result & W) >> 3);
    }
    return result;
  }

  function rotate(index: number) {
    if (failed || won) return;
    rotations[index] = (rotations[index] + 1) % 4;
    rotations = [...rotations];
    moves += 1;
    updatePower();
  }

  function updatePower() {
    const next = new Set<number>();
    const sourceCell = cellIndex(sourceRow, 0);
    const sourceMask = rotateMask(connectors[sourceCell], rotations[sourceCell]);

    if (hasConnector(sourceMask, W)) {
      const queue = [sourceCell];
      next.add(sourceCell);
      const directions = [
        { side: N, opposite: S, row: -1, column: 0 },
        { side: E, opposite: W, row: 0, column: 1 },
        { side: S, opposite: N, row: 1, column: 0 },
        { side: W, opposite: E, row: 0, column: -1 },
      ];

      while (queue.length > 0) {
        const cell = queue.shift() as number;
        const row = Math.floor(cell / GRID_SIZE);
        const column = cell % GRID_SIZE;
        const mask = rotateMask(connectors[cell], rotations[cell]);

        for (const direction of directions) {
          if (!hasConnector(mask, direction.side)) continue;
          const nextRow = row + direction.row;
          const nextColumn = column + direction.column;
          if (
            nextRow < 0 ||
            nextRow >= GRID_SIZE ||
            nextColumn < 0 ||
            nextColumn >= GRID_SIZE
          ) continue;

          const neighbour = cellIndex(nextRow, nextColumn);
          if (next.has(neighbour)) continue;
          const neighbourMask = rotateMask(
            connectors[neighbour],
            rotations[neighbour]
          );
          if (!hasConnector(neighbourMask, direction.opposite)) continue;
          next.add(neighbour);
          queue.push(neighbour);
        }
      }
    }

    powered = next;
    const sinkMask = rotateMask(connectors[sinkCell], rotations[sinkCell]);
    if (next.has(sinkCell) && hasConnector(sinkMask, E)) {
      won = true;
      stopTimer();
      setTimeout(() => gotoReplace("/minigamedone"), 800);
    }
  }

  function hasConnector(mask: number, side: number) {
    return (mask & side) !== 0;
  }
</script>

<main class="routing-page">
  <section class="card">
    <p class="eyebrow">{bi("Сетевая операция", "Network operation")}</p>
    <h1>{bi("Маршрутизация пакетов", "Packet routing")}</h1>
    <p class="description">
      {bi(
        "Поворачивайте узлы и соберите непрерывную сеть между входом и выходом. Зелёным отмечается только сигнал, который уже дошёл от входа; готовый путь заранее не показывается.",
        "Rotate nodes to build a continuous network between input and output. Green marks only the signal already connected to the input; the solution is never revealed."
      )}
    </p>

    <div class="status">
      <span>{bi("Активные узлы", "Active nodes")} <strong>{powered.size}</strong></span>
      <span>{bi("Ходы", "Moves")} <strong>{moves}</strong></span>
      <span>{bi("Время", "Time")} <strong>{timeLeft}s</strong></span>
    </div>

    <div class="network-shell">
      <span class="source" style={`top:${(sourceRow + 0.5) * (100 / GRID_SIZE)}%`}>{bi("ВХ", "IN")} →</span>
      <div class="network">
        {#each connectors as mask, index}
          <button
            type="button"
            aria-label={bi(`Сетевой узел ${index + 1}`, `Network node ${index + 1}`)}
            on:click={() => rotate(index)}
            class:powered={powered.has(index)}
            class="node"
          >
            <span
              class="wire-layer"
              style={`transform:rotate(${rotations[index] * 90}deg)`}
            >
              <i class="center"></i>
              <i class="north" class:visible={hasConnector(mask, N)}></i>
              <i class="east" class:visible={hasConnector(mask, E)}></i>
              <i class="south" class:visible={hasConnector(mask, S)}></i>
              <i class="west" class:visible={hasConnector(mask, W)}></i>
            </span>
          </button>
        {/each}
      </div>
      <span class="sink" style={`top:${(sinkRow + 0.5) * (100 / GRID_SIZE)}%`}>→ {bi("ВЫХ", "OUT")}</span>
    </div>

    {#if failed}
      <div class="overlay">
        <strong>{bi("Маршрут потерян", "Route lost")}</strong>
        <button type="button" on:click={startGame}>
          {bi("Создать новую сеть", "Build a new network")}
        </button>
      </div>
    {/if}

    {#if won}<p class="success">{bi("Пакет доставлен", "Packet delivered")}</p>{/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    overflow: hidden;
    background: #020504;
  }

  .routing-page {
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
    background: radial-gradient(circle at top, rgba(16, 185, 129, 0.17), transparent 28rem), #020504;
    color: #fff;
  }

  .card {
    position: relative;
    flex: 0 0 auto;
    min-width: 0;
    width: min(620px, 100%);
    margin: auto 0;
    padding: clamp(15px, 4vw, 23px);
    border: 1px solid rgba(52, 211, 153, 0.22);
    border-radius: 24px;
    background: rgba(4, 10, 8, 0.97);
  }

  .eyebrow {
    margin: 0;
    color: #6ee7b7;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 6px 0 8px;
    font-size: clamp(25px, 7vw, 40px);
    font-weight: 950;
    line-height: 1;
  }

  .description {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    line-height: 1.4;
  }

  .status {
    margin: 14px 0;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
  }

  .status strong {
    color: #6ee7b7;
  }

  .network-shell {
    position: relative;
    padding: 0 39px;
  }

  .network {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: clamp(3px, 1.2vw, 6px);
    padding: 7px;
    border: 1px solid rgba(52, 211, 153, 0.1);
    border-radius: 16px;
    background: #020706;
  }

  .source,
  .sink {
    position: absolute;
    z-index: 2;
    transform: translateY(-50%);
    color: #34d399;
    font-size: 10px;
    font-weight: 950;
    white-space: nowrap;
  }

  .source { left: 0; }
  .sink { right: 0; }

  .node {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid rgba(148, 163, 184, 0.13);
    border-radius: clamp(7px, 2vw, 11px);
    overflow: hidden;
    background: #090d0c;
    opacity: 0.92;
    touch-action: manipulation;
  }

  .wire-layer {
    position: absolute;
    inset: 0;
    display: block;
    transition: transform 0.16s ease;
  }

  .wire-layer i {
    position: absolute;
    display: none;
    background: #475569;
  }

  .wire-layer i.visible,
  .wire-layer .center {
    display: block;
  }

  .wire-layer .center {
    width: 18%;
    height: 18%;
    left: 41%;
    top: 41%;
    border-radius: 50%;
  }

  .north,
  .south {
    width: 9%;
    height: 50%;
    left: 45.5%;
  }

  .north { top: 0; }
  .south { bottom: 0; }

  .east,
  .west {
    width: 50%;
    height: 9%;
    top: 45.5%;
  }

  .east { right: 0; }
  .west { left: 0; }

  .node.powered {
    border-color: rgba(52, 211, 153, 0.7);
    box-shadow: inset 0 0 15px rgba(16, 185, 129, 0.12);
  }

  .node.powered i {
    background: #34d399;
    box-shadow: 0 0 9px #10b981;
  }

  .node:active {
    transform: scale(0.92);
  }

  .success {
    margin: 12px 0 0;
    text-align: center;
    color: #6ee7b7;
    font-size: 19px;
    font-weight: 950;
  }

  .overlay {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-content: center;
    gap: 12px;
    padding: 20px;
    text-align: center;
    border-radius: 24px;
    background: rgba(0, 0, 0, 0.9);
  }

  .overlay strong { font-size: 24px; }

  .overlay button {
    padding: 13px;
    border: 1px solid #34d399;
    border-radius: 12px;
    background: #065f46;
    color: #fff;
    font-weight: 900;
  }

  @media (max-height: 680px) {
    .routing-page { place-items: start center; }
    .description { display: none; }
    .status { margin: 8px 0; }
  }

  @media (max-width: 380px) {
    .card { padding: 12px; }
    .network-shell { padding: 0 18px; }
    .network { gap: 3px; padding: 5px; }
    .source,
    .sink { font-size: 7px; }
  }
</style>
