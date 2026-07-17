<script lang="ts">
  import { DEV_PANEL_KEY } from "./consts";
  import { lobbyStore, playerStore } from "$lib/stores";
  import { emitGameAction, getSocketIO } from "./websocket";
  import type { Color } from "./types";
  import { gotoReplace } from "./util";
  import type { Socket } from "socket.io-client";
  import { onMount } from "svelte";
  import { language } from "$lib/i18n";

  let io: Socket;
  let playerColor: Color;
  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  onMount(() => {
    io = getSocketIO();
    if ($playerStore) {
      playerColor = $playerStore.color;
    }
  });

  function changeTasks() {
    io.emit("devChangeTasks");
  }

  function killPlayerHandler(killedPlayer: Color) {
    emitGameAction({ action: "killPlayer", targetColor: killedPlayer });
  }

  function reportDeadBodyHandler(bodyColor: Color) {
    emitGameAction({ action: "reportDeadBody", bodyColor });
  }

  function startTaskHandler(taskNumber: number) {
    emitGameAction({ action: "startTask", taskNumber });
  }

  const buttons = [
    { ru: "Сменить роль", en: "Change role", action: () => {
      const me = $playerStore!;
      io.emit("devSetPlayerRole", {
        role: me.role.name === "impostor" ? "crew" : "impostor",
      });
    }},
    { ru: "Созвать собрание", en: "Call meeting", action: () => gotoReplace("/meetingbutton") },

    { ru: "Войти на собрание", en: "Enter meeting", action: () => {
      emitGameAction({ action: "enterMeeting" });
    }},

    { ru: "Начать задание", en: "Start task", action: () =>
      $lobbyStore != null
        ? (screen = "scanTaskScreen")
        : alert(bi("Нельзя начать задание вне лобби", "Cannot start a task outside a lobby")) },
    { ru: "Устранить/обнаружить игрока", en: "Eliminate/report player", action: () =>
      $lobbyStore != null
        ? (screen = "scanPlayerScreen")
        : alert(bi("Действие недоступно вне лобби", "Action unavailable outside a lobby")) },
    { ru: "Ремонт защиты 0", en: "Repair firewall 0", action: () =>
      $lobbyStore != null
        ? emitGameAction({ action: "startFirewallFix", number: 0})
        : alert(bi("Ремонт недоступен вне лобби", "Repair unavailable outside a lobby")) },
    { ru: "Ремонт защиты 1", en: "Repair firewall 1", action: () =>
      $lobbyStore != null
        ? emitGameAction({ action: "startFirewallFix", number: 1 })
        : alert(bi("Ремонт недоступен вне лобби", "Repair unavailable outside a lobby")) },
    { ru: "Завершить победой", en: "End with victory", action: () =>
      $playerStore?.role.name !== "undecided"
        ? io.emit("devSetLobby", {
            lobby: {
              status: {
                state: "gameEnded",
                victors: $playerStore?.role,
                reason: "Dev triggered",
              },
            },
          })
        : alert(bi("Роль не определена, победу вызвать нельзя", "A role is required to trigger victory")) },
  ];

  let screen = "main" as "main" | "scanPlayerScreen" | "scanTaskScreen";
</script>

<div class="inset-0 absolute h-min flex m-6 z-10 bg-green-800 text-white">
  <div class="flex flex-col items-center px-2 py-4 w-full">
    {#if screen === "main"}
      <h1 class="text-2xl font-semibold m-2 flex flex-col items-center">
        {bi("Панель разработчика", "Dev Panel")}
        <br />
        <span class="text-sm text-green-200"
          >{bi(`нажмите Ctrl ${DEV_PANEL_KEY}, чтобы закрыть`, `press Ctrl ${DEV_PANEL_KEY} to close`)}</span
        >
      </h1>
      <div class="grid grid-cols-2 grid-rows-4 gap-y-4 gap-x-4 mt-4">
        {#each buttons as button}
          <button class="border text-white border-white p-3" on:click={button.action}
            >{$language === "en" ? button.en : button.ru}</button
          >
        {/each}
      </div>
    {:else if screen === "scanPlayerScreen" && $lobbyStore != null}
      <div class="w-full flex justify-center flex-col items-center">
        <button
          class="text-green-200 px-4 py-2 self-start"
          on:click={() => (screen = "main")}>{bi("Назад", "Back")}</button
        >
        <h1
          class="text-2xl text-white font-semibold m-2 flex flex-col items-center"
        >
          {bi("Устранить/сообщить об игроке", "Eliminate/report player")}
        </h1>
        <div class="grid grid-cols-2 grid-rows-4 gap-y-4 gap-x-4 mt-4">
          {#each Object.values($lobbyStore.players) as player}
            {#if player.status === "alive"}
              <button
                class="border text-white border-green-300 p-3"
                on:click={() => killPlayerHandler(player.color)}
                >{bi("Устранить", "Eliminate")} {player.name} ({player.color})</button
              >
            {:else if player.status === "dead"}
              <button
                class="border text-white border-green-300 p-3"
                on:click={() => reportDeadBodyHandler(player.color)}
                >{bi("Сообщить о теле", "Report body")}: {player.name} ({player.color})</button
              >
            {:else}
              <div class="border text-green-300 border-green-300 p-3">
                {player.name} ({player.color}) — {bi("тело обнаружено", "body found")}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {:else if screen === "scanTaskScreen" && $lobbyStore != null && $playerStore != null}
      <div class="w-full flex justify-center flex-col items-center">
        <button
          class="text-green-200 px-4 py-2 self-start"
          on:click={() => (screen = "main")}>{bi("Назад", "Back")}</button
        >
        <h1
          class="text-2xl text-white font-semibold m-2 flex flex-col items-center"
        >
          {bi("Запуск задания", "Start task")}
        </h1>
        <div class="flex flex-col items-center">
          <button
            on:click={changeTasks}
            class="border-green-200 border px-2 py-2">{bi("Сменить задания", "Cycle tasks")}</button
          >
          <div class="grid grid-cols-2 grid-rows-4 gap-y-4 gap-x-4 mt-4">
            {#each $playerStore.tasks as task}
              <button
                class="border text-white border-green-300 p-3"
                on:click={() => startTaskHandler(task.number)}
                >{bi("Задание", "Task")} {task.number}<br />({bi("статус", "status")}: {task.status})</button
              >
            {/each}
          </div>
          {#if $playerStore.tasks.length === 0}
            <div class="w-full text-center">
              {bi("Заданий пока нет. Кнопка смены заданий выдаст три новых.", "You do not have any tasks yet. Cycle tasks will give you three new ones.")}
            </div>
          {/if}
        </div>
      </div>
    {/if}
    <h1 class="text-lg font-semibold m-2 flex flex-col items-center">
      {bi("Состояние", "Status info")}
    </h1>
    <div class="grid grid-cols-2">
      <div>{bi("Цвет", "Color")}: <span class="font-semibold">{$playerStore?.color}</span></div>
      <div>
        {bi("Роль", "Role")}: <span class="font-semibold">{$playerStore?.role.name}</span>
        {#if $playerStore?.role.name === "impostor"}
          <div class="text-sm ml-4">
            {bi("Устранение", "Elimination")} CD:
            <span class="font-bold">{$playerStore?.role.killCooldown}</span><br
            />
            {bi("Саботаж", "Sabotage")} CD:
            <span class="font-bold">{$playerStore?.role.sabotageCooldown}</span>
          </div>
        {/if}
      </div>

      <div>
        {bi("Статус", "Status")}: <span class="font-semibold">{$playerStore?.status}</span>
      </div>
      <div>
        {bi("Действие", "Activity")}: <span class="font-semibold"
          >{$playerStore?.currentlyDoing.activity}</span
        >
      </div>
      <div>
        {bi("Задания", "Tasks")}: <span class="text-sm"
          >{($playerStore?.tasks.length ?? 0) > 0
            ? $playerStore?.tasks.reduce(
                (list, t) => (list += `${t.name}(${t.number}), `),
                ""
              )
            : bi("нет", "none")}</span
        >
      </div>
      <div>
        {bi("Состояние лобби", "Lobby state")}:
        <span class="font-semibold">{$lobbyStore?.status.state}</span>
      </div>

      <div>
        {bi("Активные эффекты", "Active effects")}:
        <span class="font-semibold">
          {#each Object.entries($lobbyStore?.activeEffects ?? {}) as [effect, info]}
            {#if info != null}
              {effect}
            {/if}
          {/each}
        </span>
      </div>
    </div>
  </div>
</div>
