<script lang="ts">
  import ScanButton from "$lib/ScanButton.svelte";
  import TaskBar from "$lib/TaskBar.svelte";
  import { getAgentPanelDragState } from "$lib/agentPanelSwipe";
  import { COLORS } from "$lib/consts";
  import {
    devNotiStore,
    lobbyStore,
    playerColorStore,
    playerStore,
    showNotificationBar,
  } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction, getSocketIO } from "$lib/websocket";
  import { onMount, tick } from "svelte";
  import {
    FIREWALL_COOLDOWN,
    FIREWALL_FIX_TIME,
    HACK_COOLDOWN,
    TASKS,
    VIRUS_SCAN_COOLDOWN,
  } from "../../../server/consts";
  import { language, t } from "$lib/i18n";
  import { localizeLocationName } from "$lib/locationSetup";
  import type { Player } from "$lib/types";

  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  $: sabotageCooldown =
    $playerStore?.role.name === "impostor"
      ? Math.max(0, $playerStore.role.sabotageCooldown)
      : 0;

  let mainDiv: HTMLDivElement;
  let taskContentDiv: HTMLDivElement;
  let impostorDiv: HTMLDivElement;
  let impostorScreen = false;
  let touchStartY = 0;
  let touchStartX = 0;
  let swipeStartedAtTop = false;
  let swipeStartedAtBottom = false;
  let swipeStartedAt = 0;
  let swipeInput: "pointer" | "touch" | null = null;
  let panelHeight = 1;
  let panelOffset = 0;
  let panelDragging = false;
  let suppressTaskPressUntil = 0;
  let suppressPanelClickUntil = 0;
  let wallClock = Date.now();
  let repairClockStartedAt = Date.now();
  let repairInitialRemainingMs = 0;
  let lastRepairSnapshot: Player["currentlyDoing"] | null = null;

  $: repairSnapshot = $playerStore?.currentlyDoing ?? null;
  $: if (repairSnapshot !== lastRepairSnapshot) {
    lastRepairSnapshot = repairSnapshot;
    if (repairSnapshot?.activity === "fixFirewall") {
      repairClockStartedAt = Date.now();
      repairInitialRemainingMs = repairSnapshot.readyInMs;
    }
  }

  $: firewallRepairSecondsLeft =
    $playerStore?.currentlyDoing.activity === "fixFirewall"
      ? Math.max(
          0,
          Math.ceil(
            (repairInitialRemainingMs - (wallClock - repairClockStartedAt)) /
              1000
          )
        )
      : 0;

  $: if ($playerStore?.role.name !== "impostor" && impostorScreen) {
    settleAgentPanel(false);
  }

  function beginSwipe(
    clientX: number,
    clientY: number,
    target: EventTarget | null,
    input: "pointer" | "touch"
  ) {
    if ($playerStore?.role.name !== "impostor") return;
    const element = target as Element | null;
    if (
      element?.closest(
        "[data-scan-button], a, input, select, textarea, canvas"
      )
    )
      return;
    const scrollContainer = impostorScreen ? impostorDiv : taskContentDiv;
    const scrollTop = scrollContainer?.scrollTop ?? 0;
    const scrollHeight = scrollContainer?.scrollHeight ?? 0;
    const clientHeight = scrollContainer?.clientHeight ?? 0;
    swipeStartedAtTop = scrollTop <= 4;
    swipeStartedAtBottom = scrollTop + clientHeight >= scrollHeight - 4;

    // Opening continues past the bottom of tasks. Closing pulls down from the
    // top of the private panel. Normal content scrolling stays native.
    if (
      (!impostorScreen && !swipeStartedAtBottom) ||
      (impostorScreen && !swipeStartedAtTop)
    )
      return;

    swipeInput = input;
    touchStartY = clientY;
    touchStartX = clientX;
    swipeStartedAt = performance.now();
    panelHeight = Math.max(1, mainDiv?.clientHeight || window.innerHeight);
    panelOffset = impostorScreen ? -panelHeight : 0;
  }

  function getCurrentDrag(clientX: number, clientY: number) {
    return getAgentPanelDragState({
      deltaX: clientX - touchStartX,
      deltaY: clientY - touchStartY,
      elapsedMs: performance.now() - swipeStartedAt,
      panelOpen: impostorScreen,
      contentAtTop: swipeStartedAtTop,
      contentAtBottom: swipeStartedAtBottom,
      viewportHeight: panelHeight,
    });
  }

  function updateSwipe(
    clientX: number,
    clientY: number,
    input: "pointer" | "touch"
  ) {
    if ($playerStore?.role.name !== "impostor") return false;
    if (swipeInput !== input) return false;

    const drag = getCurrentDrag(clientX, clientY);
    if (drag == null) return false;

    panelDragging = true;
    panelOffset = drag.offset;
    return true;
  }

  function finishSwipe(
    clientX: number,
    clientY: number,
    input: "pointer" | "touch"
  ) {
    if (swipeInput !== input) return;
    const drag = getCurrentDrag(clientX, clientY);
    swipeInput = null;

    if (!panelDragging) return;
    suppressTaskPressUntil = Date.now() + 500;
    suppressPanelClickUntil = Date.now() + 500;
    if (drag?.target === "abilities") settleAgentPanel(true);
    else if (drag?.target === "tasks") settleAgentPanel(false);
    else settleAgentPanel(impostorScreen);
  }

  function handlePointerStart(event: PointerEvent) {
    // Touch-capable browsers often dispatch both pointer and touch events for
    // the same finger. Let the non-passive touch path own finger gestures.
    if (!event.isPrimary || event.pointerType === "touch") return;
    beginSwipe(event.clientX, event.clientY, event.target, "pointer");
    if (swipeInput === "pointer") {
      (event.currentTarget as HTMLDivElement).setPointerCapture?.(
        event.pointerId
      );
    }
  }

  function handlePointerEnd(event: PointerEvent) {
    if (!event.isPrimary || event.pointerType === "touch") return;
    finishSwipe(event.clientX, event.clientY, "pointer");
  }

  function handlePointerMove(event: PointerEvent) {
    if (!event.isPrimary || event.pointerType === "touch") return;
    if (updateSwipe(event.clientX, event.clientY, "pointer")) {
      event.preventDefault();
    }
  }

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (touch) beginSwipe(touch.clientX, touch.clientY, event.target, "touch");
  }

  function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (touch) finishSwipe(touch.clientX, touch.clientY, "touch");
  }

  function handleTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    if (
      touch &&
      updateSwipe(touch.clientX, touch.clientY, "touch")
    ) {
      event.preventDefault();
    }
  }

  function cancelSwipe(input: "pointer" | "touch") {
    if (swipeInput !== input) return;
    swipeInput = null;
    if (panelDragging) {
      suppressPanelClickUntil = Date.now() + 500;
      settleAgentPanel(impostorScreen);
    }
  }

  function suppressClickAfterDrag(event: MouseEvent) {
    if (Date.now() >= suppressPanelClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
  }

  onMount(() => {
    const io = getSocketIO();

    if ($lobbyStore == null || $playerStore == null) {
      gotoReplace(`/`);
      return;
    }

    if ($playerStore.currentlyDoing.activity !== "fixFirewall") {
      emitGameAction({ action: "clearCurrentActivity" });
    }

    const clockInterval = window.setInterval(() => {
      if (!$lobbyStore?.pause?.active) wallClock = Date.now();
    }, 250);

    const resizeObserver = new ResizeObserver(() => {
      panelHeight = Math.max(1, mainDiv?.clientHeight || window.innerHeight);
      if (!panelDragging) panelOffset = impostorScreen ? -panelHeight : 0;
    });
    resizeObserver.observe(mainDiv);
    mainDiv.addEventListener("click", suppressClickAfterDrag, true);
    panelHeight = Math.max(1, mainDiv.clientHeight || window.innerHeight);
    panelOffset = impostorScreen ? -panelHeight : 0;

    io.on("virusScan", () => {
      if (
        $playerStore?.role.name === "crew" &&
        $playerStore?.status === "alive" &&
        $playerStore.currentlyDoing.activity === "nothing"
      ) {
        gotoReplace("/dontmove");
      }
    });

    return () => {
      window.clearInterval(clockInterval);
      resizeObserver.disconnect();
      mainDiv.removeEventListener("click", suppressClickAfterDrag, true);
      io.off("virusScan");
      $showNotificationBar = true;
    };
  });

  function isExtraTask(task: any) {
    return task.isExtraTask === true;
  }

  function activityLabel(activity: string) {
    if ($language === "ru") {
      return activity === "nothing"
        ? "свободен"
        : activity === "task"
          ? "задание"
          : activity === "fixFirewall"
            ? "защита"
            : activity === "awaitingSync"
              ? "ожидает синхронизацию"
              : activity === "playerSync"
                ? "синхронизация"
            : activity;
    }
    return activity === "nothing"
      ? "idle"
      : activity === "task"
        ? "task"
        : activity === "fixFirewall"
          ? "firewall"
          : activity === "awaitingSync"
            ? "waiting for synchronization"
            : activity === "playerSync"
              ? "synchronizing"
          : activity;
  }

  async function settleAgentPanel(open: boolean) {
    panelDragging = false;
    impostorScreen = open;
    $showNotificationBar = !open;
    panelOffset = open ? -panelHeight : 0;
    if (!open) impostorDiv?.scrollTo({ top: 0, behavior: "auto" });

    // Hiding the notification bar gives the game container its full height.
    // Recalculate after Svelte applies that class change so the panel settles
    // flush with the viewport rather than one notification-bar height below it.
    await tick();
    if (impostorScreen !== open || panelDragging) return;
    panelHeight = Math.max(1, mainDiv?.clientHeight || window.innerHeight);
    panelOffset = open ? -panelHeight : 0;
  }

  function pressHandler(task: number) {
    if (Date.now() < suppressTaskPressUntil) return;
    if ($playerStore?.role.name === "impostor") {
      emitGameAction({ action: "toggleAgentTask", taskNumber: task });
    }
  }

  function handleScanned(contents: string) {
    devNotiStore.set("Scanned contents " + contents);
    gotoReplace(`/scan?tag=${encodeURIComponent(contents)}`);
  }
</script>

{#if $lobbyStore != null && $playerStore != null}
  <div
    bind:this={mainDiv}
    on:pointerdown={handlePointerStart}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerEnd}
    on:pointercancel={() => cancelSwipe("pointer")}
    on:touchstart={handleTouchStart}
    on:touchmove|nonpassive={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:touchcancel={() => cancelSwipe("touch")}
    class="mainDiv"
    class:notifications-visible={!impostorScreen}
    class:agent-panel-dragging={panelDragging}
    style={`--agent-panel-offset:${panelOffset}px`}
  >
    <div
      class="game-screen flex flex-col justify-between items-center"
    >
      <div bind:this={taskContentDiv} class="task-content w-full px-5">
        <div class="my-4">
          <TaskBar taskProgress={$lobbyStore.taskProgression.displayed} />
        </div>

        <section
          class="sync-task-card"
          class:complete={$playerStore.syncTask?.completed === true}
          class:incoming={$lobbyStore.playerSync?.state === "incoming"}
        >
          <div class="sync-task-heading">
            <span>{bi("ОБЯЗАТЕЛЬНЫЙ КАНАЛ", "REQUIRED CHANNEL")}</span>
            <strong>{$playerStore.syncTask?.completed ? "100%" : "0%"}</strong>
          </div>

          {#if $lobbyStore.playerSync?.state === "incoming"}
            <b>{bi("Входящий запрос", "Incoming request")}</b>
            <p>
              {bi(
                `${$lobbyStore.playerSync.partnerName} ждёт обратного сканирования. Подойдите и отсканируйте метку этого игрока.`,
                `${$lobbyStore.playerSync.partnerName} is waiting for your reverse scan. Approach and scan this player's tag.`
              )}
            </p>
          {:else if $playerStore.syncTask?.completed}
            <b>{bi("Синхронизация выполнена", "Synchronization complete")}</b>
            <p>{bi("Личные задания разблокированы.", "Personal tasks are unlocked.")}</p>
          {:else}
            <b>{bi("Синхронизируйтесь с другим игроком", "Synchronize with another player")}</b>
            <p>
              {bi(
                "Отсканируйте метки друг друга и оставайтесь рядом до заполнения 15-секундной шкалы. До этого личные задания заблокированы.",
                "Scan each other's tags and stay together until the 15-second bar fills. Personal tasks remain locked until then."
              )}
            </p>
          {/if}
        </section>

        {#if $playerStore.currentlyDoing.activity === "fixFirewall"}
          <section class="firewall-repair-card" class:ready={firewallRepairSecondsLeft === 0}>
            <span>{bi("ВОССТАНОВЛЕНИЕ ЗАЩИТЫ", "FIREWALL RECOVERY")}</span>
            <strong>
              {firewallRepairSecondsLeft > 0
                ? bi(`${firewallRepairSecondsLeft} сек.`, `${firewallRepairSecondsLeft}s`)
                : bi("ГОТОВО", "READY")}
            </strong>
            <p>
              {firewallRepairSecondsLeft > 0
                ? bi(
                    `Оставайтесь у терминала ${$playerStore.currentlyDoing.number + 1}. После отсчёта снова отсканируйте эту же NFC-метку или QR-код.`,
                    `Stay at terminal ${$playerStore.currentlyDoing.number + 1}. When the countdown ends, scan the same NFC tag or QR code again.`
                  )
                : bi(
                    "Повторно отсканируйте этот терминал, чтобы подтвердить ремонт.",
                    "Scan this terminal again to confirm the repair."
                  )}
            </p>
          </section>
        {/if}

        <p class="text-lg mt-8">{$t("game.tasks")}</p>

        <ol class="task-list">
          {#each $playerStore.tasks.filter((task) => !isExtraTask(task)) as task}
            <li class:opacity-50={task.status === "completed"}>
              <button
                type="button"
                class="task-action"
                on:click={() => pressHandler(task.number)}
              >
                <span
                  class:line-through={task.status === "completed"}
                  class:text-gray-400={task.status === "completed"}
                >
                  {$language === "en" && task.descriptionEn
                    ? task.descriptionEn
                    : task.description}
                </span>

                {#if task.status === "completed"}
                  <span class="text-green-400 ml-1">✓</span>
                {:else if task.name === "wiretap"}
                  <span class="text-sky-300 ml-1 font-bold">
                    ({task.completedCheckpoints?.length || 0}/3)
                  </span>
                {/if}
              </button>
            </li>
          {/each}
        </ol>

        {#if $playerStore.tasks.some((task) => isExtraTask(task))}
          <div class="mt-6 border-t border-gray-700 pt-4">
            <p class="text-sm uppercase tracking-wide text-purple-300 font-bold">
              {$t("game.extraTask")}
            </p>

            <ol class="task-list extra-task-list">
              {#each $playerStore.tasks.filter((task) => isExtraTask(task)) as task}
                <li
                  class:opacity-50={task.status === "completed"}
                >
                  <div class="task-row-content">
                    <span
                      class:line-through={task.status === "completed"}
                      class:text-gray-400={task.status === "completed"}
                    >
                      {$language === "en" && task.descriptionEn
                        ? task.descriptionEn
                        : task.description}
                    </span>

                    {#if task.status === "completed"}
                      <span class="text-green-400 ml-1">✓</span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ol>

            <p class="text-xs text-gray-400 mt-2">
              {$t("game.extraHint")}
            </p>
          </div>
        {/if}
      </div>
      <div class="scanner-dock self-center">
        <ScanButton on:scanned={({ detail }) => handleScanned(detail.result)} />
      </div>
    </div>

    {#if $playerStore.role.name === "impostor"}
      <div
        bind:this={impostorDiv}
        class="impostor-screen"
        aria-label={$t("role.impostor")}
        aria-hidden={!impostorScreen}
      >
        <div class="agent-panel-intro">
          <span class="panel-handle" aria-hidden="true"></span>
          <div>
            <p>{$t("game.agentConsole")}</p>
            <small>{$t("game.agentConsoleHint")}</small>
          </div>
        </div>

        <section class="agent-panel-card players-state">
          <header class="agent-section-header">
            <h2>{$t("game.state")}</h2>
            <span class="section-count">
              {Object.values($lobbyStore.players).filter(
                ({ color }) => color !== $playerColorStore
              ).length}
            </span>
          </header>

          <div class="player-state-list">
          <!-- Alive players -->
          {#each Object.values($lobbyStore.players) as { color, name, status, currentlyDoing }}
            {#if color !== $playerColorStore && status === "alive"}
              <div class="player-state-row">
                <span class={COLORS[color] + " player-dot"}></span>
                <div class="player-state-copy">
                  <strong>{name}</strong>
                  <span>
                    {$t("game.action")}:
                    <b>{activityLabel(currentlyDoing.activity)}</b>
                  {currentlyDoing.activity === "task"
                    ? `${bi("в", "in")} ${localizeLocationName(
                        $lobbyStore.activities[TASKS[currentlyDoing.number].name]
                          .room,
                        $language
                      )}`
                    : ""}
                  </span>
                </div>
              </div>
            {/if}
          {/each}

          <!-- Dead players -->
          {#if Object.values($lobbyStore.players).some(
            ({ color, status }) => color !== $playerColorStore && status !== "alive"
          )}
            <div class="state-separator"></div>
            {#each Object.values($lobbyStore.players) as { color, name, status }}
              {#if color !== $playerColorStore && status !== "alive"}
                <div class="player-state-row dead-player">
                  <span class={COLORS[color] + " player-dot"}></span>
                  <div class="player-state-copy">
                    <strong>{name}</strong>
                    <span>{status === "dead" ? $t("game.dead") : status}</span>
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
          </div>
        </section>

        <section class="agent-panel-card sabotage-panel">
          <header class="agent-section-header">
            <h2>{$t("game.sabotage")}</h2>
          </header>

          <div class="cooldown-console" class:ready={sabotageCooldown === 0}>
            <span class="cooldown-indicator" aria-hidden="true"></span>
            <div>
              <small>{$t("game.sharedCooldown")}</small>
              <strong>
                {sabotageCooldown > 0
                  ? $t("game.readyIn", { seconds: sabotageCooldown })
                  : $t("game.ready")}
              </strong>
            </div>
            <b>{sabotageCooldown > 0 ? sabotageCooldown : "✓"}</b>
          </div>

          <div class="ability-list">
            <button
              type="button"
              class="ability-action"
              data-agent-action="firewall"
              on:click={() =>
                emitGameAction({
                  action: "launchSabotage",
                  sabotage: { kind: "firewallBreach" },
                })}
              disabled={$playerStore.role.sabotageCooldown > 0 ||
                $lobbyStore.activeEffects.hacked != null ||
                $lobbyStore.activeEffects.firewallBreach != null}
            >
              <span class="ability-index" aria-hidden="true">01</span>
              <span class="ability-action-heading">
                <strong>{$t("game.firewall")}</strong>
                <small>
                  {$t("game.cooldown", { seconds: FIREWALL_COOLDOWN })}
                </small>
              </span>
              <span class="ability-description">
                {$t("game.firewallText", {
                  room1: localizeLocationName(
                    $lobbyStore.activities["firewallbutton1"].room,
                    $language
                  ),
                  room2: localizeLocationName(
                    $lobbyStore.activities["firewallbutton2"].room,
                    $language
                  ),
                  seconds: FIREWALL_FIX_TIME,
                })}
              </span>
            </button>

            <button
              type="button"
              class="ability-action"
              data-agent-action="virus"
              on:click={() =>
                emitGameAction({
                  action: "launchSabotage",
                  sabotage: { kind: "virusScan" },
                })}
              disabled={$playerStore.role.sabotageCooldown > 0 ||
                $lobbyStore.activeEffects.hacked != null ||
                $lobbyStore.activeEffects.firewallBreach != null}
            >
              <span class="ability-index" aria-hidden="true">02</span>
              <span class="ability-action-heading">
                <strong>{$t("game.virus")}</strong>
                <small>
                  {$t("game.cooldown", { seconds: VIRUS_SCAN_COOLDOWN })}
                </small>
              </span>
              <span class="ability-description">
                {$t("game.virusText")}
              </span>
            </button>

            <div class="hack-ability">
              <span class="ability-index cyan" aria-hidden="true">03</span>
              <div class="ability-action-heading">
                <strong>{$t("game.hack")}</strong>
                <small>
                  {$t("game.cooldown", { seconds: HACK_COOLDOWN })}
                </small>
              </div>
              <p class="ability-description">{$t("game.hackText")}</p>

              <div class="hack-targets">
                {#each Object.values($lobbyStore.players).filter(
                  (target) =>
                    !target.isHostOnly &&
                    target.color !== $playerColorStore &&
                    target.status === "alive" &&
                    target.role.name !== "impostor"
                ) as target}
                  <button
                    type="button"
                    class="hack-target-button"
                    data-agent-action="hack"
                    on:click={() =>
                      emitGameAction({
                        action: "launchSabotage",
                        sabotage: { kind: "hackPlayer", target: target.color },
                      })}
                    disabled={$playerStore.role.sabotageCooldown > 0 ||
                      $lobbyStore.activeEffects.hacked != null ||
                      $lobbyStore.activeEffects.firewallBreach != null}
                  >
                    <span class={COLORS[target.color] + " target-dot"}></span>
                    <span>{$t("game.hackTarget", { name: target.name })}</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    class="hack-target-button"
                    data-agent-action="hack-unavailable"
                    disabled
                  >
                    <span>{$t("game.hackNoTargets")}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </section>

      </div>
    {/if}
  </div>
{/if}

<style>
  .mainDiv {
    position: relative;
    isolation: isolate;
    width: 100%;
    height: var(--app-height);
    overflow-x: hidden;
    overflow-y: hidden;
    scrollbar-width: none;
    touch-action: pan-y;
  }

  .mainDiv.notifications-visible {
    height: calc(var(--app-height) - var(--notification-height));
  }

  .game-screen,
  .impostor-screen {
    position: absolute;
    inset: 0;
    width: 100%;
    min-height: 100%;
    height: 100%;
    transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    will-change: transform;
    backface-visibility: hidden;
  }

  .game-screen {
    transform: translate3d(0, var(--agent-panel-offset), 0);
    padding:
      0 max(var(--safe-right), 0px)
      max(10px, var(--safe-bottom)) max(var(--safe-left), 0px);
  }

  .impostor-screen {
    transform: translate3d(0, calc(100% + var(--agent-panel-offset)), 0);
  }

  .mainDiv.agent-panel-dragging .game-screen,
  .mainDiv.agent-panel-dragging .impostor-screen {
    transition: none;
  }

  .task-content {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    padding-left: clamp(16px, 5vw, 32px);
    padding-right: clamp(16px, 5vw, 32px);
    padding-top: max(54px, calc(var(--safe-top) + 44px));
    padding-bottom: 18px;
  }

  .scanner-dock {
    flex: 0 0 auto;
    padding: 10px 12px 0;
    display: grid;
    justify-items: center;
    gap: 8px;
  }

  .task-list {
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 11px;
    list-style: none;
    counter-reset: game-task;
  }

  .task-list li {
    min-width: 0;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: start;
    gap: 8px;
    counter-increment: game-task;
  }

  .task-list li::before {
    content: counter(game-task) ".";
    padding-top: 1px;
    color: rgba(134, 239, 172, 0.8);
    font-size: 13px;
    font-weight: 900;
    line-height: 1.45;
    text-align: right;
  }

  .task-action,
  .task-row-content {
    min-width: 0;
    width: 100%;
    padding: 0;
    color: inherit;
    font-size: 14px;
    line-height: 1.45;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .task-action {
    display: block;
    touch-action: pan-y;
  }

  .extra-task-list li::before {
    color: rgba(216, 180, 254, 0.86);
  }

  .sync-task-card {
    margin-top: 12px;
    padding: 14px;
    border: 1px solid rgba(56, 189, 248, 0.38);
    border-radius: 16px;
    background: rgba(7, 89, 133, 0.18);
  }

  .sync-task-card.incoming {
    border-color: rgba(250, 204, 21, 0.62);
    background: rgba(113, 63, 18, 0.24);
    animation: sync-request-pulse 1.2s alternate infinite;
  }

  .sync-task-card.complete {
    border-color: rgba(74, 222, 128, 0.45);
    background: rgba(20, 83, 45, 0.2);
  }

  .sync-task-heading {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: #7dd3fc;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.1em;
  }

  .sync-task-card.complete .sync-task-heading { color: #86efac; }
  .sync-task-card.incoming .sync-task-heading { color: #fde68a; }

  .sync-task-card b {
    display: block;
    margin-top: 7px;
    font-size: 14px;
  }

  .sync-task-card p {
    margin: 5px 0 0;
    color: rgba(255, 255, 255, 0.66);
    font-size: 12px;
    line-height: 1.4;
  }

  .firewall-repair-card {
    margin-top: 12px;
    padding: 14px;
    border: 1px solid rgba(250, 204, 21, 0.52);
    border-radius: 16px;
    background: rgba(113, 63, 18, 0.24);
  }

  .firewall-repair-card.ready {
    border-color: rgba(74, 222, 128, 0.55);
    background: rgba(20, 83, 45, 0.24);
  }

  .firewall-repair-card span {
    display: block;
    color: #fde68a;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.1em;
  }

  .firewall-repair-card.ready span { color: #86efac; }

  .firewall-repair-card strong {
    display: block;
    margin-top: 6px;
    font-size: 20px;
  }

  .firewall-repair-card p {
    margin: 5px 0 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    line-height: 1.45;
  }

  @keyframes sync-request-pulse {
    to { box-shadow: inset 0 0 22px rgba(250, 204, 21, 0.1); }
  }

  .impostor-screen {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding:
      max(74px, calc(var(--safe-top) + 62px))
      max(16px, var(--safe-right))
      max(24px, var(--safe-bottom))
      max(16px, var(--safe-left));
    overflow-y: auto;
    overscroll-behavior-y: contain;
    touch-action: pan-y;
    background:
      radial-gradient(circle at 50% 8%, rgba(34, 211, 238, 0.075), transparent 23rem),
      linear-gradient(180deg, rgba(5, 10, 19, 0.98), rgba(0, 0, 0, 0.98));
  }

  .agent-panel-intro {
    flex: 0 0 auto;
    min-width: 0;
    padding: 4px 4px 8px;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }

  .panel-handle {
    width: 26px;
    height: 4px;
    border-radius: 999px;
    background: rgba(103, 232, 249, 0.55);
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.25);
  }

  .agent-panel-intro p {
    margin: 0;
    color: #a5f3fc;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .agent-panel-intro small {
    display: block;
    margin-top: 2px;
    color: rgba(255, 255, 255, 0.38);
    font-size: 8px;
    line-height: 1.35;
  }

  .agent-panel-card {
    flex: 0 0 auto;
    min-width: 0;
    padding: clamp(14px, 4vw, 18px);
    border: 1px solid rgba(103, 232, 249, 0.14);
    border-radius: 21px;
    background: rgba(8, 16, 29, 0.82);
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.28), inset 0 1px rgba(255, 255, 255, 0.025);
  }

  .agent-section-header {
    min-width: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .agent-section-header h2 {
    min-width: 0;
    margin: 0;
    color: #fff;
    font-size: clamp(18px, 5vw, 23px);
    font-weight: 950;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .section-count {
    min-width: 30px;
    height: 25px;
    padding: 0 8px;
    border: 1px solid rgba(103, 232, 249, 0.18);
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: rgba(8, 145, 178, 0.08);
    color: #a5f3fc;
    font-size: 10px;
    font-weight: 950;
  }

  .player-state-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
    gap: 7px;
    margin-top: 12px;
  }

  .player-state-row {
    min-width: 0;
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr);
    align-items: start;
    gap: 9px;
    padding: 9px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 13px;
    background: rgba(0, 0, 0, 0.2);
  }

  .player-dot {
    width: 10px;
    height: 10px;
    margin-top: 4px;
    border-radius: 999px;
  }

  .player-state-copy {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .player-state-copy strong {
    font-size: 13px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .player-state-copy span {
    color: rgba(255, 255, 255, 0.65);
    font-size: 11px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .player-state-copy b {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 800;
  }

  .dead-player {
    opacity: 0.62;
  }

  .state-separator {
    grid-column: 1 / -1;
    height: 1px;
    margin: 2px 0;
    background: rgba(255, 255, 255, 0.15);
  }

  .cooldown-console {
    margin-top: 12px;
    padding: 11px 12px;
    border: 1px solid rgba(251, 191, 36, 0.24);
    border-radius: 15px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    background: rgba(120, 53, 15, 0.14);
  }

  .cooldown-console.ready {
    border-color: rgba(74, 222, 128, 0.25);
    background: rgba(20, 83, 45, 0.14);
  }

  .cooldown-indicator {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #fbbf24;
    box-shadow: 0 0 12px rgba(251, 191, 36, 0.5);
    animation: cooldown-pulse 1.2s ease-in-out infinite alternate;
  }

  .cooldown-console.ready .cooldown-indicator {
    background: #4ade80;
    box-shadow: 0 0 12px rgba(74, 222, 128, 0.5);
    animation: none;
  }

  .cooldown-console small {
    display: block;
    color: rgba(255, 255, 255, 0.38);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .cooldown-console strong {
    display: block;
    margin-top: 2px;
    color: #fde68a;
    font-size: 12px;
    font-weight: 950;
  }

  .cooldown-console.ready strong { color: #86efac; }

  .cooldown-console b {
    min-width: 32px;
    color: white;
    font-size: 25px;
    line-height: 1;
    text-align: right;
  }

  .ability-list {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .ability-action,
  .hack-ability {
    position: relative;
    width: 100%;
    min-width: 0;
    padding: 13px 13px 13px 47px;
    border: 1px solid rgba(74, 222, 128, 0.34);
    border-radius: 15px;
    background: linear-gradient(110deg, rgba(20, 83, 45, 0.2), rgba(8, 28, 24, 0.34));
    color: #fff;
    text-align: left;
  }

  .ability-action {
    min-height: 80px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    cursor: pointer;
  }

  .ability-action:not(:disabled):active,
  .hack-target-button:not(:disabled):active {
    transform: translateY(1px);
    border-color: rgba(134, 239, 172, 0.78);
    background: rgba(22, 101, 52, 0.3);
  }

  .ability-action:disabled,
  .hack-target-button:disabled {
    cursor: not-allowed;
  }

  .ability-action:disabled {
    border-color: rgba(74, 222, 128, 0.13);
    background: rgba(20, 83, 45, 0.065);
  }

  .ability-action:disabled .ability-description,
  .ability-action:disabled .ability-action-heading small {
    color: rgba(255, 255, 255, 0.43);
  }

  .ability-action:disabled .ability-action-heading strong {
    color: rgba(187, 247, 208, 0.58);
  }

  .ability-index {
    position: absolute;
    top: 14px;
    left: 13px;
    color: rgba(74, 222, 128, 0.72);
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.04em;
  }

  .ability-index.cyan { color: rgba(103, 232, 249, 0.76); }

  .ability-action-heading {
    min-width: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ability-action-heading strong {
    color: #bbf7d0;
    font-size: 14px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .ability-action-heading small {
    color: rgba(255, 255, 255, 0.56);
    font-size: 9px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .ability-description {
    margin: 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 11px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .hack-ability {
    border-color: rgba(34, 211, 238, 0.34);
    background: linear-gradient(110deg, rgba(8, 47, 73, 0.3), rgba(8, 24, 38, 0.38));
  }

  .hack-targets {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    margin-top: 11px;
  }

  .hack-target-button {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    padding: 9px 10px;
    border: 1px solid rgba(34, 211, 238, 0.48);
    border-radius: 12px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    background: rgba(8, 145, 178, 0.12);
    color: #cffafe;
    text-align: left;
  }

  .hack-target-button span {
    color: rgba(255, 255, 255, 0.7);
    font-size: 9px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .hack-target-button .target-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .hack-target-button:disabled {
    border-color: rgba(34, 211, 238, 0.14);
    background: rgba(8, 145, 178, 0.045);
    color: rgba(207, 250, 254, 0.46);
  }

  @keyframes cooldown-pulse {
    to { opacity: 0.42; transform: scale(0.8); }
  }

  .ability-action:focus-visible,
  .hack-target-button:focus-visible {
    outline: 2px solid #67e8f9;
    outline-offset: 2px;
  }

  .mainDiv::-webkit-scrollbar {
    display: none;
  }

  @media (min-width: 760px) {
    .task-content,
    .impostor-screen {
      width: min(760px, 100%);
      margin-right: auto;
      margin-left: auto;
    }
  }

  @media (orientation: landscape) and (max-height: 560px) {
    .game-screen {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: stretch;
    }

    .scanner-dock {
      display: grid;
      place-items: center;
      padding: 12px;
    }

    .impostor-screen {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-content: start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .game-screen,
    .impostor-screen {
      transition: none;
    }

    .cooldown-indicator { animation: none; }
  }
</style>
