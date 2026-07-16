<script lang="ts">
  import { page } from "$app/stores";
  import { gotoReplace } from "$lib/util";
  import { lobbyStore, playerColorStore, playerStore } from "$lib/stores";
  import { onMount, tick } from "svelte";
  import MainButton from "$lib/MainButton.svelte";
  import { emitGameAction, getSocketIO } from "$lib/websocket";
  import type { Socket } from "socket.io-client";
  import type { Color } from "$lib/types";
  import { language } from "$lib/i18n";

  type ScanKind = "meeting" | "task" | "player" | "firewall" | "unknown";
  type ScanSource = "qr" | "nfc" | null;

  type PendingAction =
    | {
        kind: "meetingCall";
        title: string;
        description: string;
        primaryLabel: string;
      }
    | {
        kind: "meetingEnter";
        title: string;
        description: string;
        primaryLabel: string;
      }
    | {
        kind: "task";
        title: string;
        description: string;
        primaryLabel: string;
        taskNumber: number;
        taskTag: string;
      }
    | {
        kind: "playerSync";
        title: string;
        description: string;
        primaryLabel: string;
        targetColor: Color;
        canEliminate: boolean;
      }
    | {
        kind: "reportBody";
        title: string;
        description: string;
        primaryLabel: string;
        bodyColor: Color;
      }
    | {
        kind: "playerInteraction";
        title: string;
        description: string;
        primaryLabel: string;
      }
    | {
        kind: "firewallStart";
        title: string;
        description: string;
        primaryLabel: string;
        number: number;
      }
    | {
        kind: "firewallFinish";
        title: string;
        description: string;
        primaryLabel: string;
        number: number;
      };

  let socket: Socket;

  let tag = "";
  let kind: ScanKind = "unknown";
  let value = "";
  let scanSource: ScanSource = null;

  let loading = true;
  let sessionReady = false;
  let error = "";
  let successMessage = "";
  let preflightRecorded = false;

  let pendingAction: PendingAction | null = null;
  let actionInProgress = false;
  let renderedLanguage = $language;

  let bi = (ru: string, _en: string) => ru;
  $: bi = (ru: string, en: string) => ($language === "en" ? en : ru);

  $: if ($language !== renderedLanguage) {
    renderedLanguage = $language;
    if (sessionReady && !loading && !actionInProgress && !preflightRecorded)
      prepareScanAction();
  }

    onMount(async () => {
    socket = getSocketIO();

    tag = $page.url.searchParams.get("tag") || "";
    const source = $page.url.searchParams.get("source");
    scanSource = source === "qr" || source === "nfc" ? source : null;
    parseTag();

    if ($lobbyStore != null && $playerStore != null) {
        sessionReady = true;
        loading = false;
        if (await recordPreflightCheck()) return;
        prepareScanAction();
        return;
    }

    await reconnectFromLocalStorage();

    // Give Svelte stores time to update playerStore after lobbyStore/playerColorStore are set.
    await tick();
    await tick();

    sessionReady = $lobbyStore != null && $playerStore != null;
    loading = false;

    if (!sessionReady) {
        error = bi(
          "Активная игровая сессия не найдена. Сначала вернитесь в лобби.",
          "Active game session not found. Return to the lobby first."
        );
        return;
    }

    if (await recordPreflightCheck()) return;
    prepareScanAction();
    });

  function recordPreflightCheck(): Promise<boolean> {
    if (scanSource == null || $lobbyStore == null || $playerStore == null) {
      return Promise.resolve(false);
    }

    const isPregame = ["settingRooms", "inLobby"].includes(
      $lobbyStore.status.state
    );

    return new Promise((resolve) => {
      let settled = false;
      let timeout: number | null = null;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        if (timeout != null) window.clearTimeout(timeout);
        resolve(value);
      };
      timeout = window.setTimeout(() => finish(false), 1600);

      socket.emit(
        "preflightCheck",
        { tag, method: scanSource },
        ({ success }: { success: boolean }) => {
          if (success && isPregame) {
            preflightRecorded = true;
            error = "";
            pendingAction = null;
            successMessage = bi(
              `${scanSource === "qr" ? "QR-код" : "NFC-метка"} отмечен в панели ведущего.`,
              `${scanSource === "qr" ? "QR code" : "NFC tag"} was recorded in the host panel.`
            );
            finish(true);
            return;
          }
          finish(false);
        }
      );

      if (!isPregame) finish(false);
    });
  }

  function parseTag() {
    if (tag === "meeting") {
      kind = "meeting";
      value = "meeting";
      return;
    }

    if (tag.startsWith("task:")) {
      kind = "task";
      value = tag.replace("task:", "");
      return;
    }

    if (tag.startsWith("player:")) {
      kind = "player";
      value = tag.replace("player:", "");
      return;
    }

    if (tag.startsWith("firewall:")) {
      kind = "firewall";
      value = tag.replace("firewall:", "");
      return;
    }

    kind = "unknown";
    value = tag;
  }

  function reconnectFromLocalStorage(): Promise<boolean> {
    return new Promise((resolve) => {
      const storedGameInfo = localStorage.getItem("gameInfo");

      if (storedGameInfo == null) {
        resolve(false);
        return;
      }

      let gameInfo: { playerId: string; lobbyId: string; color: Color };
      try {
        const parsed = JSON.parse(storedGameInfo);
        if (
          typeof parsed?.playerId !== "string" ||
          typeof parsed?.lobbyId !== "string" ||
          typeof parsed?.color !== "string"
        ) {
          throw new Error("Saved session is incomplete");
        }
        gameInfo = parsed;
      } catch {
        localStorage.removeItem("gameInfo");
        localStorage.removeItem("currentTaskNumber");
        localStorage.removeItem("currentTaskTag");
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        socket.off("reconnected", onReconnect);
        resolve(false);
      }, 1800);

      function onReconnect({ success, lobby, color }: any) {
        clearTimeout(timeout);

        if (success) {
          playerColorStore.set(color);
          lobbyStore.set(lobby);
          resolve(true);
        } else {
          localStorage.removeItem("gameInfo");
          resolve(false);
        }
      }

      socket.once("reconnected", onReconnect);

      socket.emit("reconnect", {
        color: gameInfo.color,
        playerId: gameInfo.playerId,
        lobbyId: gameInfo.lobbyId,
      });
    });
  }

  function prepareScanAction() {
    error = "";
    successMessage = "";
    pendingAction = null;

    if (!sessionReady || $lobbyStore == null || $playerStore == null) {
      error = bi(
        "Активная игровая сессия не найдена. Сначала вернитесь в лобби.",
        "Active game session not found. Return to the lobby first."
      );
      return;
    }

    if (kind === "meeting") {
      prepareMeetingAction();
      return;
    }

    if (kind === "task") {
      prepareTaskAction();
      return;
    }

    if (kind === "player") {
      preparePlayerInteraction();
      return;
    }

    if (kind === "firewall") {
      prepareFirewallAction();
      return;
    }

    error = bi("Неизвестная метка.", "Unknown tag.");
  }

  function prepareMeetingAction() {
    if ($lobbyStore == null || $playerStore == null) return;

    if ($playerStore.status !== "alive") {
      error = bi(
        "Погибшие игроки не могут использовать точку собрания.",
        "Dead players cannot use the meeting point."
      );
      return;
    }

    if ($lobbyStore.status.state === "meetingCalled") {
      pendingAction = {
        kind: "meetingEnter",
        title: bi("Место собрания", "Meeting point"),
        description: bi(
          "Собрание уже созвано. Подтвердите, что вы прибыли на место.",
          "A meeting has already been called. Confirm that you have arrived."
        ),
        primaryLabel: bi("Войти на собрание", "Enter meeting"),
      };
      return;
    }

    if ($lobbyStore.status.state !== "started") {
      error = bi(
        "Экстренную точку можно использовать только во время активного раунда.",
        "The emergency point can only be used during an active round."
      );
      return;
    }

    pendingAction = {
      kind: "meetingCall",
      title: bi("Экстренная точка", "Emergency point"),
      description: bi(
        "Вы отсканировали экстренную точку. Подтвердите, только если хотите созвать собрание.",
        "You scanned the emergency point. Confirm only if you want to call a meeting."
      ),
      primaryLabel: bi("Созвать собрание", "Call meeting"),
    };
  }

  function prepareTaskAction() {
    if ($playerStore == null || $lobbyStore == null) return;

    if ($lobbyStore.status.state !== "started") {
      error = bi(
        "Задания доступны только во время активного раунда.",
        "Tasks are only available during an active round."
      );
      return;
    }

    const taskNumber = getTaskNumberFromTag(value);

    if (taskNumber == null) {
      error = bi(
        `Неизвестная метка задания: ${value}`,
        `Unknown task tag: ${value}`
      );
      return;
    }

    if ($playerStore.status !== "alive") {
      error = bi(
        "Погибшие игроки не могут начинать задания.",
        "Dead players cannot start tasks."
      );
      return;
    }

    if (
      $playerStore.syncTask?.required === true &&
      $playerStore.syncTask.completed !== true
    ) {
      error = bi(
        "Сначала выполните обязательную синхронизацию с другим игроком.",
        "Complete the required synchronization with another player first."
      );
      return;
    }

    if ($playerStore.taskLockedUntil > Date.now()) {
      const secondsLeft = Math.max(
        1,
        Math.ceil(($playerStore.taskLockedUntil - Date.now()) / 1000)
      );
      error = bi(
        `После вирусной проверки задания заблокированы ещё на ${secondsLeft} сек.`,
        `Tasks remain locked for ${secondsLeft}s after the virus scan.`
      );
      return;
    }

    const task = $playerStore.tasks.find((task) => task.number === taskNumber);

    if (task == null) {
      error = bi("Это задание вам не назначено.", "This task is not assigned to you.");
      return;
    }

    if (task.status === "completed") {
      error = bi("Это задание уже выполнено.", "This task is already complete.");
      return;
    }

    if (task.name === "wiretap") {
      const checkpoints = ["wiretap1", "wiretap2", "wiretap3"];

      if (!checkpoints.includes(value)) {
        error = bi(
          "Для перехвата используйте одну из трёх отдельных меток сигнала.",
          "Use one of the three distinct signal tags for interception."
        );
        return;
      }

      if (task.completedCheckpoints?.includes(value)) {
        error = bi(
          "Эта точка перехвата уже завершена. Найдите другую метку сигнала.",
          "This interception station is already complete. Find another signal tag."
        );
        return;
      }
    }

    if (
      $playerStore.currentlyDoing.activity !== "nothing" &&
      $playerStore.currentlyDoing.activity !== "task"
    ) {
      error = bi("Вы уже выполняете другое действие.", "Another action is already in progress.");
      return;
    }

    pendingAction = {
      kind: "task",
      title: bi("Задание найдено", "Task found"),
      description: bi(
        `Отсканировано задание «${formatTaskName(task.name)}». Начать сейчас?`,
        `“${formatTaskName(task.name)}” scanned. Start now?`
      ),
      primaryLabel: bi("Начать задание", "Start task"),
      taskNumber,
      taskTag: value,
    };
  }

  function preparePlayerInteraction() {
    if ($lobbyStore == null || $playerStore == null) return;

    if ($lobbyStore.status.state !== "started") {
      error = bi(
        "Метки игроков доступны только во время активного раунда.",
        "Player tags are only available during an active round."
      );
      return;
    }

    const color = value as Color;
    const targetPlayer = $lobbyStore.players[color];

    if (targetPlayer == null) {
      error = bi(`Неизвестная метка игрока: ${color}`, `Unknown player tag: ${color}`);
      return;
    }

    if ($playerStore.status !== "alive") {
      error = bi(
        "Погибшие не могут взаимодействовать с метками игроков.",
        "Dead players cannot interact with player tags."
      );
      return;
    }

    if (targetPlayer.color === $playerStore.color) {
      pendingAction = {
        kind: "playerInteraction",
        title: bi("Проверка личности", "Identity check"),
        description: bi(
          "Вы отсканировали собственную метку. Ничего не произошло.",
          "You scanned your own tag. Nothing happened."
        ),
        primaryLabel: bi("Вернуться в игру", "Return to game"),
      };
      return;
    }

    if (targetPlayer.status === "dead") {
      pendingAction = {
        kind: "reportBody",
        title: bi("Взаимодействие с игроком", "Player interaction"),
        description: bi(
          `${targetPlayer.name} погиб. Сообщите о теле или отмените случайное сканирование.`,
          `${targetPlayer.name} is dead. Report the body or cancel an accidental scan.`
        ),
        primaryLabel: bi("Сообщить о теле", "Report body"),
        bodyColor: color,
      };
      return;
    }

    if (targetPlayer.status === "foundDead") {
      pendingAction = {
        kind: "playerInteraction",
        title: bi("Тело уже обнаружено", "Body already found"),
        description: bi(
          `${targetPlayer.name} уже отмечен как обнаруженный. Повторное сообщение не требуется.`,
          `${targetPlayer.name} has already been marked as found. No second report is needed.`
        ),
        primaryLabel: bi("Вернуться в игру", "Return to game"),
      };
      return;
    }

    const isReverseConfirmation =
      $lobbyStore.playerSync?.state === "incoming" &&
      $lobbyStore.playerSync.partnerColor === color;
    pendingAction = {
      kind: "playerSync",
      title: bi("Защищённая синхронизация", "Secure synchronization"),
      description: bi(
        isReverseConfirmation
          ? `${targetPlayer.name} уже отправил запрос. Подтвердите обратное сканирование — после этого начнётся 15-секундная синхронизация.`
          : `Предложите ${targetPlayer.name} отсканировать вашу метку в ответ. После взаимного сканирования стойте рядом до заполнения шкалы.`,
        isReverseConfirmation
          ? `${targetPlayer.name} already sent a request. Confirm the reverse scan to start the 15-second synchronization.`
          : `Ask ${targetPlayer.name} to scan your tag in return. After both scans, stay together until the progress bar fills.`
      ),
      primaryLabel: isReverseConfirmation
        ? bi("Подтвердить синхронизацию", "Confirm synchronization")
        : bi("Отправить запрос", "Send request"),
      targetColor: color,
      canEliminate:
        $playerStore.role.name === "impostor" &&
        $playerStore.role.killCooldown <= 0 &&
        targetPlayer.role.name !== "impostor",
    };
  }

  function prepareFirewallAction() {
    if ($lobbyStore == null || $playerStore == null) return;

    const firewallNumber = getFirewallNumberFromTag(value);

    if (firewallNumber == null) {
      error = bi(`Неизвестная метка защиты: ${value}`, `Unknown firewall tag: ${value}`);
      return;
    }

    if ($playerStore.status !== "alive") {
      error = bi(
        "Погибшие игроки не могут восстанавливать защиту.",
        "Dead players cannot restore the firewall."
      );
      return;
    }

    if ($lobbyStore.status.state !== "started") {
      error = bi(
        "Терминалы защиты доступны только во время активного раунда.",
        "Firewall terminals are only available during an active round."
      );
      return;
    }

    if ($lobbyStore.activeEffects.firewallBreach == null) {
      error = bi("Сейчас нет активного взлома защиты.", "There is no active firewall breach.");
      return;
    }

    if (
      $playerStore.currentlyDoing.activity !== "nothing" &&
      $playerStore.currentlyDoing.activity !== "fixFirewall"
    ) {
      error = bi("Вы уже выполняете другое действие.", "Another action is already in progress.");
      return;
    }

    if ($playerStore.currentlyDoing.activity === "fixFirewall") {
      if ($playerStore.currentlyDoing.number !== firewallNumber) {
        error = bi(
          `Вы начали ремонт терминала ${$playerStore.currentlyDoing.number + 1}. Завершите его на той же точке.`,
          `You started repairing terminal ${$playerStore.currentlyDoing.number + 1}. Finish at the same point.`
        );
        return;
      }

      pendingAction = {
        kind: "firewallFinish",
        title: bi("Терминал защиты", "Firewall terminal"),
        description: bi(
          `Подтвердите завершение ремонта терминала ${firewallNumber + 1}.`,
          `Confirm completion of terminal ${firewallNumber + 1} repairs.`
        ),
        primaryLabel: bi("Завершить ремонт", "Finish repair"),
        number: firewallNumber,
      };
      return;
    }

    pendingAction = {
      kind: "firewallStart",
      title: bi("Терминал защиты", "Firewall terminal"),
      description: bi(
        `Начать ремонт терминала ${firewallNumber + 1}.`,
        `Start repairing terminal ${firewallNumber + 1}.`
      ),
      primaryLabel: bi("Начать ремонт", "Start repair"),
      number: firewallNumber,
    };
  }

  async function confirmAction(syncMode: "sync" | "eliminate" = "sync") {
    if (pendingAction == null || actionInProgress) return;

    actionInProgress = true;
    error = "";
    successMessage = "";

    switch (pendingAction.kind) {
      case "meetingCall":
        if ((await emitGameAction({ action: "callMeeting" })).success) {
          gotoReplace("/meetingcall");
        } else actionInProgress = false;
        break;

      case "meetingEnter":
        if ((await emitGameAction({ action: "enterMeeting" })).success) {
          gotoReplace("/awaitMeeting");
        } else actionInProgress = false;
        break;

      case "task":
        localStorage.setItem("currentTaskNumber", String(pendingAction.taskNumber));
        localStorage.setItem("currentTaskTag", pendingAction.taskTag);

        if (!(await emitGameAction({
          action: "startTask",
          taskNumber: pendingAction.taskNumber,
          taskTag: pendingAction.taskTag,
        })).success) {
          localStorage.removeItem("currentTaskNumber");
          localStorage.removeItem("currentTaskTag");
          actionInProgress = false;
          break;
        }

        if (pendingAction.taskNumber === 1000) {
          gotoReplace("/minigame/secret");
        } else {
          gotoReplace(`/minigame/${pendingAction.taskNumber}`);
        }
        break;

      case "playerSync":
        if (!(await emitGameAction({
          action: "requestPlayerSync",
          targetColor: pendingAction.targetColor,
          mode: syncMode,
        })).success) {
          actionInProgress = false;
        } else gotoReplace("/sync");
        break;

      case "reportBody":
        if ((await emitGameAction({
          action: "reportDeadBody",
          bodyColor: pendingAction.bodyColor,
        })).success) {
          gotoReplace("/meetingcall");
        } else actionInProgress = false;
        break;

      case "playerInteraction":
        gotoReplace("/game");
        break;

      case "firewallStart":
        if (!(await emitGameAction({
          action: "startFirewallFix",
          number: pendingAction.number,
        })).success) {
          actionInProgress = false;
          break;
        }
        successMessage = bi(
          "Ремонт начат. Оставайтесь у терминала и отсканируйте его снова для завершения.",
          "Repair started. Stay at the terminal and scan it again to finish."
        );
        actionInProgress = false;
        pendingAction = {
          kind: "firewallFinish",
          title: bi("Терминал защиты", "Firewall terminal"),
          description: bi(
            "Сканирование подтверждено. Завершите действие после ремонта терминала.",
            "Scan confirmed. Complete the action after repairing the terminal."
          ),
          primaryLabel: bi("Завершить ремонт", "Finish repair"),
          number: pendingAction.number,
        };
        break;

      case "firewallFinish":
        if ((await emitGameAction({
          action: "finishFirewallFix",
          number: pendingAction.number,
        })).success) {
          gotoReplace("/game");
        } else actionInProgress = false;
        break;
    }
  }

  function cancelAction() {
    if ($lobbyStore != null && $playerStore != null) {
      if ($lobbyStore.status.state === "settingRooms") {
        gotoReplace(
          $playerStore.name === $lobbyStore.creator ? "/setuprooms" : "/lobby"
        );
      } else if ($lobbyStore.status.state === "inLobby") {
        gotoReplace("/lobby");
      } else if ($playerStore.status === "alive") {
        gotoReplace("/game");
      } else if ($playerStore.status === "dead") {
        gotoReplace("/killed");
      } else {
        gotoReplace("/dead");
      }
    } else {
      gotoReplace("/");
    }
  }

  function getTaskNumberFromTag(taskTag: string): number | null {
    const taskMap: Record<string, number> = {
      simonsays: 0,
      wiretap: 1,
      wiretap1: 1,
      wiretap2: 1,
      wiretap3: 1,
      passwordcrack: 2,
      bitcoinmine: 3,
      killthevirus: 4,
      sumtohundred: 5,
      destroyevidence: 6,
      packetrouting: 7,
      accesslog: 8,
      powergrid: 9,
      secret: 1000,
      secretlongtask: 1000,
      systemoverride: 1000,
    };

    return taskMap[taskTag] ?? null;
  }

  function getFirewallNumberFromTag(firewallTag: string): number | null {
    const firewallMap: Record<string, number> = {
      "0": 0,
      firewallbutton1: 0,
      button1: 0,
      "1": 1,
      firewallbutton2: 1,
      button2: 1,
    };

    return firewallMap[firewallTag] ?? null;
  }

  function formatTaskName(name: string) {
    const names: Record<string, [string, string]> = {
      simonsays: ["Повтор последовательности", "Sequence relay"],
      wiretap: ["Перехват сигнала", "Signal interception"],
      passwordcrack: ["Взлом пароля", "Password crack"],
      bitcoinmine: ["Хеш-реактор", "Hash reactor"],
      killthevirus: ["Уничтожение вирусов", "Virus cleanup"],
      sumtohundred: ["Сумма до ста", "Sum to one hundred"],
      destroyevidence: ["Уничтожение улик", "Evidence disposal"],
      packetrouting: ["Маршрутизация пакетов", "Packet routing"],
      accesslog: ["Анализ журнала", "Access log analysis"],
      powergrid: ["Стабилизация энергосети", "Power grid stabilization"],
      secretlongtask: ["Переопределение системы", "System override"],
    };
    return names[name] ? bi(...names[name]) : name;
  }
</script>

<div class="scan-page">
    {#if loading}
    <section class="scan-card">
        <p class="eyebrow">{bi("Метка распознана", "Tag recognized")}</p>
        <h1>{bi("Обработка…", "Processing…")}</h1>
        <p class="muted">{bi("Проверка состояния игры.", "Checking game state.")}</p>
    </section>
  {:else if preflightRecorded}
    <section class="scan-card success-card">
      <p class="eyebrow">{bi("Проверка площадки", "Venue check")}</p>
      <h1>{bi("Точка работает", "Point verified")}</h1>
      <p class="muted">{successMessage}</p>
      <p class="tag-value">{tag}</p>
      <div class="actions">
        <MainButton on:click={cancelAction}>{bi("Вернуться в лобби", "Return to lobby")}</MainButton>
      </div>
    </section>
  {:else if error}
    <section class="scan-card error-card">
      <p class="eyebrow">{bi("Ошибка сканирования", "Scan error")}</p>
      <h1>{bi("Метка недоступна", "Tag unavailable")}</h1>
      <p class="muted">{error}</p>

      <div class="actions">
        <MainButton on:click={cancelAction}>{bi("Вернуться в игру", "Return to game")}</MainButton>
      </div>
    </section>
  {:else if pendingAction}
    <section class="scan-card">
      <p class="eyebrow">{bi("Взаимодействие", "Interaction")}</p>
      <h1>{pendingAction.title}</h1>
      <p class="muted">{pendingAction.description}</p>

      {#if successMessage}
        <p class="success">{successMessage}</p>
      {/if}

      <div class="actions">
        <MainButton disabled={actionInProgress} on:click={() => confirmAction()}>
          {actionInProgress ? bi("Подождите…", "Please wait…") : pendingAction.primaryLabel}
        </MainButton>

        {#if pendingAction.kind === "playerSync" && pendingAction.canEliminate}
          <button
            type="button"
            class="covert-button"
            disabled={actionInProgress}
            on:click={() => confirmAction("eliminate")}
          >
            {bi("Скрыто: устранить после синхронизации", "Covert: eliminate after synchronization")}
          </button>
        {/if}

        <button class="secondary-button" on:click={cancelAction}>
          {bi("Отмена", "Cancel")}
        </button>
      </div>
    </section>
  {:else}
    <section class="scan-card">
      <p class="eyebrow">{bi("Сканирование", "Scanning")}</p>
      <h1>{bi("Готово", "Ready")}</h1>
      <p class="muted">{bi("Подтвердите действие.", "Confirm the action.")}</p>

      <div class="actions">
        <MainButton on:click={prepareScanAction}>{bi("Продолжить", "Continue")}</MainButton>
      </div>
    </section>
  {/if}
</div>

<style>
  .scan-page {
    width: 100%;
    min-height: 100%;
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.18), transparent 32%),
      #000;
  }

  .scan-card {
    width: 100%;
    max-width: 430px;
    padding: 28px;
    border-radius: 26px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.5);
    text-align: center;
  }

  .error-card {
    border-color: rgba(248, 113, 113, 0.35);
    background: rgba(127, 29, 29, 0.22);
  }

  .success-card {
    border-color: rgba(74, 222, 128, 0.42);
    background: rgba(20, 83, 45, 0.24);
  }

  .tag-value {
    margin: 14px 0 0;
    color: #86efac;
    font-size: 12px;
    font-weight: 900;
    overflow-wrap: anywhere;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: rgba(134, 239, 172, 0.85);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 900;
    line-height: 1.1;
  }

  .muted {
    margin: 16px 0 0;
    color: rgba(255, 255, 255, 0.68);
    font-size: 15px;
    line-height: 1.45;
  }

  .success {
    margin: 16px 0 0;
    color: #86efac;
    font-size: 14px;
    line-height: 1.35;
  }

  .actions {
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .secondary-button {
    min-width: 160px;
    padding: 10px 18px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.78);
    font-weight: 700;
  }

  .covert-button {
    width: min(100%, 340px);
    min-height: 46px;
    padding: 11px 16px;
    border: 1px solid rgba(248, 113, 113, 0.55);
    border-radius: 13px;
    background: rgba(127, 29, 29, 0.32);
    color: #fecaca;
    font-size: 12px;
    font-weight: 900;
    line-height: 1.25;
  }

  .covert-button:disabled {
    opacity: 0.5;
  }

  .secondary-button:active {
    transform: scale(0.98);
  }
</style>
