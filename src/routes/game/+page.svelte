<script lang="ts">
  import ScanButton from "$lib/ScanButton.svelte";
  import SmallButton from "$lib/SmallButton.svelte";
  import TaskBar from "$lib/TaskBar.svelte";
  import { COLORS } from "$lib/consts";
  import {
    devNotiStore,
    lobbyStore,
    notificationStore,
    playerColorStore,
    playerStore,
    showNotificationBar,
  } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction, getSocketIO } from "$lib/websocket";
  import { onMount } from "svelte";
  // import { press, swipe } from "svelte-gestures";
  import {
    FIREWALL_COOLDOWN,
    FIREWALL_FIX_TIME,
    TASKS,
    VIRUS_SCAN_COOLDOWN,
  } from "../../../server/consts";
  import { language, t } from "$lib/i18n";
  import { localizeLocationName } from "$lib/locationSetup";

  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  let mainDiv: HTMLDivElement;
  let impostorDiv: HTMLDivElement;
  let impostorScreen = false;
  let touchStartY = 0;
  let touchStartX = 0;
  let swipeInput: "pointer" | "touch" | null = null;

  function beginSwipe(
    clientX: number,
    clientY: number,
    target: EventTarget | null,
    input: "pointer" | "touch"
  ) {
    const element = target as Element | null;
    if (element?.closest("button, a, input, select, textarea, canvas")) return;
    swipeInput = input;
    touchStartY = clientY;
    touchStartX = clientX;
  }

  function finishSwipe(
    clientX: number,
    clientY: number,
    input: "pointer" | "touch"
  ) {
    if ($playerStore?.role.name !== "impostor") return;
    if (swipeInput !== input) return;
    swipeInput = null;

    const deltaY = clientY - touchStartY;
    const deltaX = clientX - touchStartX;

    const absY = Math.abs(deltaY);
    const absX = Math.abs(deltaX);

    if (absY < 56 || absY < absX * 1.15) return;

    if (deltaY < 0) {
      scrollDown();
    } else {
      scrollUp();
    }
  }

  function handlePointerStart(event: PointerEvent) {
    if (!event.isPrimary) return;
    beginSwipe(event.clientX, event.clientY, event.target, "pointer");
  }

  function handlePointerEnd(event: PointerEvent) {
    if (!event.isPrimary) return;
    finishSwipe(event.clientX, event.clientY, "pointer");
  }

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (touch) beginSwipe(touch.clientX, touch.clientY, event.target, "touch");
  }

  function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (touch) finishSwipe(touch.clientX, touch.clientY, "touch");
  }

  function cancelSwipe() {
    swipeInput = null;
  }

  onMount(() => {
    const io = getSocketIO();

    if ($lobbyStore == null || $playerStore == null) {
      gotoReplace(`/`);
      return;
    }

    emitGameAction({ action: "clearCurrentActivity" });

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
      io.off("virusScan");
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

  function scrollDown() {
    $showNotificationBar = false;
    impostorScreen = true;
    mainDiv.scroll({ top: mainDiv.scrollHeight, behavior: "smooth" });
  }

  function scrollUp() {
    $showNotificationBar = true;
    impostorScreen = false;
    mainDiv.scroll({ top: 0, behavior: "smooth" });
  }

  // function swipeHandler(event: any) {
  //   if ($playerStore?.role.name !== "impostor") return;
  //   if (event.detail.direction === "top") scrollDown();
  //   if (event.detail.direction === "bottom") scrollUp();
  // }

  function pressHandler(task: number) {
    if ($playerStore?.role.name === "impostor") {
      emitGameAction({ action: "taskCompleted", taskNumber: task });
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
    on:pointerup={handlePointerEnd}
    on:pointercancel={cancelSwipe}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
    on:touchcancel={cancelSwipe}
    class="mainDiv"
    class:notifications-visible={!impostorScreen}
  >
    <div
      class="game-screen flex flex-col justify-between items-center"
    >
      <div class="task-content w-full px-5">
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

        <p class="text-lg mt-8">{$t("game.tasks")}</p>

        <ul class="list-disc list-inside space-y-3 mt-2">
          {#each $playerStore.tasks.filter((task) => !isExtraTask(task)) as task}
            <li class:opacity-50={task.status === "completed"}>
              <button
                type="button"
                class="text-left"
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
        </ul>

        {#if $playerStore.tasks.some((task) => isExtraTask(task))}
          <div class="mt-6 border-t border-gray-700 pt-4">
            <p class="text-sm uppercase tracking-wide text-purple-300 font-bold">
              {$t("game.extraTask")}
            </p>

            <ul class="list-disc list-inside space-y-3 mt-2">
              {#each $playerStore.tasks.filter((task) => isExtraTask(task)) as task}
                <li
                  class:opacity-50={task.status === "completed"}
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
                  {/if}
                </li>
              {/each}
            </ul>

            <p class="text-xs text-gray-400 mt-2">
              {$t("game.extraHint")}
            </p>
          </div>
        {/if}
      </div>
      <div class="scanner-dock self-center">
        {#if $playerStore.role.name === "impostor"}
          <button type="button" class="ability-switch" on:click={scrollDown}>
            ↑ {$t("game.openAbilities")}
          </button>
        {/if}
        <ScanButton on:scanned={({ detail }) => handleScanned(detail.result)} />
      </div>
    </div>

    {#if $playerStore.role.name === "impostor"}
      <div
        bind:this={impostorDiv}
        class="impostor-screen flex flex-col"
      >
        <button type="button" class="ability-switch back" on:click={scrollUp}>
          ↓ {$t("game.returnTasks")}
        </button>

        <div class="players-state text-sm">
          <p class="font-bold text-2xl">{$t("game.state")}</p>
          <!-- Alive players -->
          {#each Object.values($lobbyStore.players) as { color, name, status, currentlyDoing }}
            {#if color !== $playerColorStore && status === "alive"}
              <div class="flex items-baseline space-x-1.5">
                <div class={COLORS[color] + " w-3 h-3"} />
                <div>
                  {name} — {$t("game.action")}:
                  <span class="capitalize">{activityLabel(currentlyDoing.activity)}</span>
                  {currentlyDoing.activity === "task"
                    ? `${bi("в", "in")} ${localizeLocationName(
                        $lobbyStore.activities[TASKS[currentlyDoing.number].name]
                          .room,
                        $language
                      )}`
                    : ""}
                </div>
              </div>
            {/if}
          {/each}
          <!-- Dead players -->
          <div class="w-full border-b border-gray-600 my-2" />
          {#each Object.values($lobbyStore.players) as { color, name, status }}
            {#if color !== $playerColorStore && status !== "alive"}
              <div class="flex items-baseline space-x-1.5 text-gray-400">
                <div class={COLORS[color] + " w-3 h-3"} />
                <div>
                  {name} — {status === "dead" ? $t("game.dead") : status}
                </div>
              </div>
            {/if}
          {/each}
        </div>

        <div class="flex flex-col">
          <p class="font-bold text-2xl mb-1">
            {$t("game.sabotage")} <span class="text-base font-thin text-gray-300"
              >{$playerStore.role?.sabotageCooldown
                ? $t("game.readyIn", { seconds: $playerStore.role.sabotageCooldown })
                : $t("game.ready")}</span
            >
          </p>
          <div class="flex flex-col space-y-6 mt-2">
            <div class="flex flex-col">
              <div class="flex space-x-2 items-center">
                <SmallButton
                  on:click={() =>
                    emitGameAction({
                      action: "launchSabotage",
                      sabotage: {
                        kind: "firewallBreach",
                      },
                    })}
                  disabled={$playerStore.role.sabotageCooldown > 0}
                  >{$t("game.firewall")}</SmallButton
                >
                <div class="text-gray-300 text-xs">
                  {$t("game.cooldown", { seconds: FIREWALL_COOLDOWN })}
                </div>
              </div>
              <span class="text-gray-400 text-sm"
                >{$t("game.firewallText", {
                  room1: localizeLocationName(
                    $lobbyStore.activities["firewallbutton1"].room,
                    $language
                  ),
                  room2: localizeLocationName(
                    $lobbyStore.activities["firewallbutton2"].room,
                    $language
                  ),
                  seconds: FIREWALL_FIX_TIME,
                })}</span
              >
            </div>

            <div class="flex flex-col">
              <div class="flex space-x-2 items-center">
                <SmallButton
                  on:click={() =>
                    emitGameAction({
                      action: "launchSabotage",
                      sabotage: { kind: "virusScan" },
                    })}
                  disabled={$playerStore.role.sabotageCooldown > 0}
                  >{$t("game.virus")}</SmallButton
                >
                <div class="text-gray-300 text-xs">
                  {$t("game.cooldown", { seconds: VIRUS_SCAN_COOLDOWN })}
                </div>
              </div>
              <span class="text-gray-400 text-sm"
                >{$t("game.virusText")} <span
                  class="font-bold">{$t("game.warning")}</span
                >
                {$t("game.virusWarning")}</span
              >
            </div>
          </div>
        </div>
        <div class="flex flex-col items-center">
          <p>
            {$t("game.killReady", {
              time: $playerStore?.role.killCooldown
                ? $t("game.readyIn", { seconds: $playerStore.role.killCooldown })
                : $t("game.ready"),
            })}
          </p>
          <div class="self-center mb-2 mt-2 flex flex-col items-center">
            <ScanButton
              on:scanned={({ detail }) => handleScanned(detail.result)}
            />
            <span class="text-gray-400 text-xs"
              >{$t("game.killHint")}</span
            >
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .mainDiv {
    width: 100%;
    height: var(--app-height);
    overflow-x: hidden;
    overflow-y: hidden;
    scroll-snap-type: y mandatory;
    scrollbar-width: none;
    touch-action: pan-y;
  }

  .mainDiv.notifications-visible {
    height: calc(var(--app-height) - 3.5rem);
  }

  .game-screen,
  .impostor-screen {
    width: 100%;
    min-height: 100%;
    height: 100%;
    scroll-snap-align: start;
  }

  .game-screen {
    padding:
      0 max(var(--safe-right), 0px)
      max(10px, var(--safe-bottom)) max(var(--safe-left), 0px);
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

  @keyframes sync-request-pulse {
    to { box-shadow: inset 0 0 22px rgba(250, 204, 21, 0.1); }
  }

  .impostor-screen {
    gap: clamp(18px, 4vh, 34px);
    padding:
      max(58px, calc(var(--safe-top) + 46px))
      max(16px, var(--safe-right))
      max(12px, var(--safe-bottom))
      max(16px, var(--safe-left));
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }

  .ability-switch {
    width: min(100%, 18rem);
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid rgba(248, 113, 113, 0.42);
    border-radius: 12px;
    background: rgba(127, 29, 29, 0.22);
    color: #fecaca;
    font-size: 12px;
    font-weight: 900;
    touch-action: manipulation;
  }

  .ability-switch.back {
    width: 100%;
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.8);
  }

  .players-state {
    min-height: 0;
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
</style>
