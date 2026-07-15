import { io, server } from "./socketio.js";
import {
  createLobby,
  getAdminSnapshot,
  flushLobbiesToDisk,
  getHostAdminRoom,
  getLobby,
  joinLobby,
} from "./lobbies.js";
import { playerNameValid } from "./player.js";
import { config } from "./config.js";
import { NFC_ACTIVITIES, TEST_MODE_MIN_PLAYERS } from "./consts.js";

io.on("connection", (client) => {
  console.debug(`Client connected ${client.id}`);

  let currentPlayer = null;
  let playerLobby = null;

  function attachPlayerToSocket(lobby, player) {
    if (player.socketId != null && player.socketId !== client.id) {
      io.to(player.socketId).emit("sessionReplaced");
    }

    playerLobby = lobby;
    currentPlayer = player;

    currentPlayer.socketId = client.id;
    currentPlayer.connection = "connected";

    client.join(lobby.id);
    client.join(player.id);
  }

  function emitJoinedLobby(lobby, player) {
    client.emit("joinedLobby", {
      lobby: lobby.serializeForPlayer(player.color),
      color: player.color,
      id: player.id,
    });
  }

  function emitReconnected(lobby, player) {
    client.emit("reconnected", {
      success: true,
      lobby: lobby.serializeForPlayer(player.color),
      color: player.color,
    });
  }

  function isStaleSocket() {
    return currentPlayer != null && currentPlayer.socketId !== client.id;
  }

  function visibleAdminLobbies() {
    if (client.data.isAdmin) return getAdminSnapshot();
    const hostLobby = getLobby(client.data.hostLobbyId);
    return hostLobby == null ? [] : [hostLobby.serializeAdmin()];
  }

  function canManageLobby(lobbyId) {
    return client.data.isAdmin || client.data.hostLobbyId === lobbyId;
  }

  client.on("createLobby", ({ name, hostParticipates }) => {
    const normalizedName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : name;
    const [nameValid, error] = playerNameValid(normalizedName);

    if (!nameValid) {
      client.emit("error", { error });
      return;
    }

    const { lobby, player } = createLobby(normalizedName, {
      // Old/stale clients that omit the flag keep the previous behaviour.
      hostParticipates: hostParticipates !== false,
    });

    attachPlayerToSocket(lobby, player);
    emitJoinedLobby(lobby, player);

    console.debug(`${player.name} created lobby ${lobby.id}`);
  });

  client.on("joinLobby", ({ name, lobbyId }) => {
    const normalizedName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : name;
    const [nameValid, error] = playerNameValid(normalizedName);

    if (!nameValid) {
      client.emit("error", { error });
      return;
    }

    const [joinSuccess, joinResult] = joinLobby(lobbyId, normalizedName);

    if (!joinSuccess) {
      client.emit("error", { error: joinResult });
      return;
    }

    const { lobby, player } = joinResult;

    attachPlayerToSocket(lobby, player);
    emitJoinedLobby(lobby, player);

    lobby.synchronize();

    console.debug(`${player.name} joined lobby ${lobby.id}`);
  });

  client.on("reconnect", ({ color, playerId, lobbyId }) => {
    const lobby = getLobby(lobbyId);

    if (lobby == null) {
      console.debug(`Lobby ${lobbyId} does not exist anymore, can't reconnect`);
      client.emit("reconnected", { success: false });
      return;
    }

    const player = lobby.reconnectPlayer(color, playerId, client);

    if (player == null) {
      console.debug(
        `Reconnect failed for player ${playerId} in lobby ${lobbyId}`
      );
      client.emit("reconnected", { success: false });
      return;
    }

    attachPlayerToSocket(lobby, player);
    emitReconnected(lobby, player);

    lobby.synchronize();

    console.debug(`Client reconnected ${player.name}`);
    console.debug(`Player ${player.name} reconnected successfully`);
  });

  client.on("setActivities", ({ activities } = {}, acknowledge = () => {}) => {
    if (currentPlayer == null || playerLobby == null) {
      console.error(`Cannot set activities as one of these is null`, {
        currentPlayer,
        playerLobby,
      });
      acknowledge({ success: false, message: "Активная сессия лобби не найдена." });
      return;
    }

    if (isStaleSocket()) {
      console.debug(`Rejected setActivities from stale socket`);
      acknowledge({ success: false, message: "Эта сессия заменена новым подключением." });
      return;
    }

    if (playerLobby.creator !== currentPlayer.name) {
      acknowledge({ success: false, message: "Только ведущий может настраивать площадку." });
      return;
    }

    if (playerLobby.status.state !== "settingRooms") {
      acknowledge({ success: false, message: "Площадку можно настроить только до входа в лобби." });
      return;
    }

    if (activities == null || typeof activities !== "object") {
      acknowledge({ success: false, message: "Конфигурация площадки отсутствует или повреждена." });
      return;
    }

    const normalizedActivities = {};
    for (const [index, name] of NFC_ACTIVITIES.entries()) {
      const room = activities[name]?.room?.trim();
      if (typeof room !== "string" || room.length < 1 || room.length > 80) {
        acknowledge({
          success: false,
          message: `Локация для ${name} не указана или слишком длинная.`,
        });
        return;
      }
      normalizedActivities[name] = { id: index + 1, name, room };
    }

    playerLobby.setActivities(normalizedActivities);
    acknowledge({ success: true });
  });

  client.on("startGame", (acknowledge = () => {}) => {
    console.log("startGame requested", {
      player: currentPlayer?.name,
      lobby: playerLobby?.id,
      creator: playerLobby?.creator,
      status: playerLobby?.status?.state,
      socketId: client.id,
      currentSocketId: currentPlayer?.socketId,
    });

    if (playerLobby == null || currentPlayer == null) {
      console.debug("Rejected startGame: no player or lobby attached to socket");
      acknowledge({ success: false, message: "Активная сессия лобби не найдена." });
      return;
    }

    if (isStaleSocket()) {
      console.debug(
        `Rejected startGame from stale socket for ${currentPlayer.name}`
      );
      acknowledge({ success: false, message: "Эта сессия заменена новым подключением." });
      return;
    }

    if (playerLobby.creator !== currentPlayer.name) {
      console.debug(
        `Rejected startGame: ${currentPlayer.name} is not creator ${playerLobby.creator}`
      );
      acknowledge({ success: false, message: "Только ведущий может начать игру." });
      return;
    }

    if (playerLobby.status.state !== "inLobby") {
      acknowledge({ success: false, message: "Игру можно начать только из лобби." });
      return;
    }

    const playerCount = playerLobby.nParticipatingPlayers();

    const testModeEnabled = playerLobby.testMode?.enabled === true;
    const minimumPlayers = testModeEnabled
      ? TEST_MODE_MIN_PLAYERS
      : config.minimumPlayers;

    if (playerCount < minimumPlayers) {
      console.error(
        `Cannot start game with ${playerCount} players. Minimum is ${minimumPlayers}.`
      );
      acknowledge({
        success: false,
        message: `Для старта требуется минимум игроков: ${minimumPlayers}.`,
      });
      return;
    }

    const disconnectedPlayers = playerLobby
      .participatingPlayers()
      .filter((player) => player.connection === "disconnected");

    if (disconnectedPlayers.length > 0) {
      acknowledge({
        success: false,
        message: `Отключены игроки: ${disconnectedPlayers
          .map((player) => player.name)
          .join(", ")}. Верните их в лобби или удалите через пульт.`,
      });
      return;
    }

    // Clicking "Start game" is the participating creator's own readiness
    // confirmation. Every other participating player must still be ready.
    const allPlayersReady = playerLobby.allParticipatingPlayersReadyExcept(
      currentPlayer.color
    );

    if (!testModeEnabled && !allPlayersReady) {
      acknowledge({
        success: false,
        message: "Перед стартом все игроки должны подтвердить готовность.",
      });
      return;
    }

    playerLobby.startGame();
    acknowledge({ success: true });
  });

  client.on("gameAction", (payload = {}, acknowledge = () => {}) => {
    const { action, ...info } = payload;
    let acknowledged = false;

    const accept = () => {
      if (acknowledged) return;
      acknowledged = true;
      acknowledge({ success: true, action });
    };

    const reject = (code, message) => {
      if (acknowledged) return;
      acknowledged = true;
      console.debug(`Rejected gameAction ${action}: ${message}`);
      acknowledge({ success: false, action: action || "unknown", code, message });
    };

    const applyResult = (result, fallbackMessage) => {
      if (result?.[0] === true) accept();
      else reject("ACTION_REJECTED", result?.[1] || fallbackMessage);
    };

    console.debug("gameAction", {
      player: currentPlayer?.name,
      action,
      ...info,
    });

    if (currentPlayer == null || playerLobby == null) {
      reject("NO_SESSION", "Активная сессия игрока не найдена. Вернитесь в лобби.");
      return;
    }

    if (isStaleSocket()) {
      reject("STALE_SESSION", "Игровая сессия заменена новым подключением.");
      return;
    }

    if (playerLobby.pause?.active) {
      reject("GAME_PAUSED", "Матч поставлен на паузу ведущим.");
      return;
    }

    if (currentPlayer.isHostOnly) {
      reject(
        "HOST_ONLY",
        "Ведущий управляет матчем через панель и не участвует в игровых действиях."
      );
      return;
    }

    switch (action) {
      case "callMeeting": {
        if (playerLobby.status.state !== "started") {
          reject("INVALID_GAME_STATE", "Собрание можно созвать только во время раунда.");
        } else if (currentPlayer.status !== "alive") {
          reject("PLAYER_NOT_ALIVE", "Погибшие игроки не могут созывать собрания.");
        } else if (playerLobby.status.countDown > 0) {
          reject("MEETING_COOLDOWN", `Точка собрания станет доступна через ${playerLobby.status.countDown} сек.`);
        } else if (currentPlayer.emergencyMeetingsLeft <= 0) {
          reject("NO_MEETINGS_LEFT", "У вас не осталось экстренных собраний.");
        } else {
          currentPlayer.emergencyMeetingsLeft -= 1;
          playerLobby.startMeetingCall("emergency", currentPlayer.color);
          accept();
        }

        break;
      }

      case "clearCurrentActivity":
        if (
          currentPlayer.currentlyDoing.activity === "awaitingSync" ||
          currentPlayer.currentlyDoing.activity === "playerSync"
        ) {
          reject(
            "SYNC_ACTIVE",
            "Сначала завершите или отмените синхронизацию."
          );
          break;
        }
        currentPlayer.currentlyDoing = { activity: "nothing" };
        playerLobby.synchronize();
        accept();
        break;

      case "enterMeeting":
        applyResult(playerLobby.addPlayerToMeeting(currentPlayer.color), "Не удалось войти на собрание.");
        break;

      case "playerReady":
        applyResult(playerLobby.addReady(currentPlayer.color), "Не удалось подтвердить готовность.");
        break;

      case "vote":
        applyResult(playerLobby.addVote(currentPlayer.color, info.vote), "Не удалось отправить голос.");
        break;

      case "reportDeadBody":
        applyResult(playerLobby.reportDeadBody(currentPlayer.color, info.bodyColor), "Не удалось сообщить о теле.");
        break;

      case "killPlayer":
        if (!config.devMode) {
          reject(
            "SYNC_REQUIRED",
            "Устранение выполняется только через взаимную синхронизацию."
          );
          break;
        }
        applyResult(playerLobby.killPlayer(info.targetColor, currentPlayer.color), "Не удалось устранить игрока.");
        break;

      case "requestPlayerSync":
        applyResult(
          playerLobby.requestPlayerSync(
            currentPlayer.color,
            info.targetColor,
            info.mode
          ),
          "Не удалось начать синхронизацию."
        );
        break;

      case "cancelPlayerSync":
        applyResult(
          playerLobby.cancelPlayerSync(currentPlayer.color),
          "Не удалось отменить синхронизацию."
        );
        break;

      case "startTask": {
        if (playerLobby.status.state !== "started") {
          reject("INVALID_GAME_STATE", "Задания доступны только во время активного раунда.");
          break;
        }

        if (currentPlayer.status !== "alive") {
          reject("PLAYER_NOT_ALIVE", "Погибшие игроки не могут начинать задания.");
          break;
        }

        if (currentPlayer.role.name !== "crew") {
          reject("INVALID_ROLE", "Только оперативники могут начинать задания.");
          break;
        }

        if (
          currentPlayer.syncTask?.required === true &&
          currentPlayer.syncTask.completed !== true
        ) {
          reject(
            "SYNC_REQUIRED",
            "Сначала выполните обязательную синхронизацию с другим игроком."
          );
          break;
        }

        if (currentPlayer.isTaskLocked()) {
          const secondsLeft = Math.max(
            1,
            Math.ceil((currentPlayer.taskLockedUntil - Date.now()) / 1000)
          );
          reject(
            "TASKS_LOCKED",
            `После вирусной проверки задания заблокированы ещё на ${secondsLeft} сек.`
          );
          break;
        }

        const taskStarted = currentPlayer.startTask(info.taskNumber);

        if (taskStarted) {
          playerLobby.synchronize();
          accept();
        } else {
          reject("TASK_NOT_AVAILABLE", "Задание недоступно или уже выполняется другое действие.");
        }

        break;
      }

      case "taskCompleted": {
        if (playerLobby.status.state !== "started") {
          reject("INVALID_GAME_STATE", "Задания можно завершать только во время активного раунда.");
          break;
        }

        if (currentPlayer.status !== "alive") {
          reject("PLAYER_NOT_ALIVE", "Погибшие игроки не могут завершать задания.");
          break;
        }

        const completedTask = currentPlayer.tasks.find(
          (task) => task.number === info.taskNumber
        );

        if (completedTask == null) {
          console.debug(
            `Rejected taskCompleted: task ${info.taskNumber} is not assigned to ${currentPlayer.name}`
          );
          reject("TASK_NOT_ASSIGNED", "Это задание вам не назначено.");
          break;
        }

        if (completedTask.status === "completed") {
          console.debug(
            `Rejected taskCompleted: task ${info.taskNumber} was already completed by ${currentPlayer.name}`
          );
          reject("TASK_ALREADY_COMPLETED", "Это задание уже выполнено.");
          break;
        }

        if (currentPlayer.role.name === "impostor") {
          if (!currentPlayer.finishTask(info.taskNumber)) {
            reject("TASK_NOT_AVAILABLE", "Не удалось сымитировать выполнение задания.");
            break;
          }
          playerLobby.synchronize();
          accept();
          break;
        }

        if (currentPlayer.role.name !== "crew") {
          reject("INVALID_ROLE", "Роль игрока ещё не определена.");
          break;
        }

        const taskWasCompleted = currentPlayer.finishTask(info.taskNumber);

        if (!taskWasCompleted) {
          console.debug(
            `Rejected taskCompleted: task ${info.taskNumber} was not actually active for ${currentPlayer.name}`
          );
          reject("TASK_NOT_ACTIVE", "Задание не было запущено. Снова отсканируйте точку.");
          break;
        }

        if (completedTask.isExtraTask !== true) {
          playerLobby.increaseTaskBar();
        }

        if (currentPlayer.hasCompletedAllRegularTasks()) {
          const secretTaskAssigned = currentPlayer.assignSecretExtraTask();

          if (secretTaskAssigned) {
            console.debug(`Secret extra task assigned to ${currentPlayer.name}`);
          }
        }

        playerLobby.synchronize();
        accept();
        break;
      }

      case "startFirewallFix": {
        if (playerLobby.status.state !== "started") {
          reject("INVALID_GAME_STATE", "Защиту можно восстанавливать только во время раунда.");
        } else if (currentPlayer.status !== "alive") {
          reject("PLAYER_NOT_ALIVE", "Погибшие игроки не могут восстанавливать защиту.");
        } else if (playerLobby.activeEffects.firewallBreach == null) {
          reject("NO_FIREWALL_BREACH", "Активного взлома защиты нет.");
        } else if (info.number !== 0 && info.number !== 1) {
          reject("INVALID_FIREWALL", "Неизвестный терминал защиты.");
        } else if (currentPlayer.startFirewallFix(info.number)) {
          playerLobby.synchronize();
          accept();
        } else {
          reject("ACTIVITY_IN_PROGRESS", "Сначала завершите или отмените текущее действие.");
        }
        break;
      }

      case "finishFirewallFix": {
        if (playerLobby.status.state !== "started") {
          reject("INVALID_GAME_STATE", "Защиту можно восстанавливать только во время раунда.");
        } else if (currentPlayer.status !== "alive") {
          reject("PLAYER_NOT_ALIVE", "Погибшие игроки не могут восстанавливать защиту.");
        } else if (playerLobby.activeEffects.firewallBreach == null) {
          reject("NO_FIREWALL_BREACH", "Активного взлома защиты нет.");
        } else if (info.number !== 0 && info.number !== 1) {
          reject("INVALID_FIREWALL", "Неизвестный терминал защиты.");
        } else if (!currentPlayer.finishFirewallFix(info.number)) {
          reject("FIREWALL_FIX_NOT_ACTIVE", "Сначала начните восстановление защиты.");
        } else {
          applyResult(playerLobby.pressFirewallButton(info.number), "Не удалось завершить восстановление защиты.");
        }
        break;
      }

      case "launchSabotage":
        applyResult(playerLobby.launchSabotage(currentPlayer.color, info.sabotage), "Не удалось запустить саботаж.");
        break;

      case "virusScanFailed":
        applyResult(
          playerLobby.applyVirusPenalty(currentPlayer.color),
          "Не удалось применить наказание вирусной проверки."
        );
        break;

      default:
        reject("UNKNOWN_ACTION", `Unknown game action: ${action || "missing"}`);
        break;
    }
  });

  client.on("disconnect", () => {
    console.debug(
      `Client disconnected ${currentPlayer ? currentPlayer.name : ""} ${client.id}`
    );

    if (currentPlayer == null || playerLobby == null) {
      return;
    }

    if (currentPlayer.socketId !== client.id) {
      console.debug(
        `Ignoring stale disconnect for ${currentPlayer.name}: old socket ${client.id}, current socket ${currentPlayer.socketId}`
      );
      return;
    }

    playerLobby.disconnectPlayer(currentPlayer.color);
  });

  client.on("devSetLobby", ({ lobby }) => {
    if (!config.devMode) {
      client.emit("error", { error: "Действия разработчика отключены." });
      return;
    }
    if (playerLobby == null || currentPlayer == null) {
      console.error(`Cannot set a lobby; must join a lobby first`);
      return;
    }

    if (isStaleSocket()) {
      console.debug(`Rejected devSetLobby from stale socket`);
      return;
    }

    console.debug(`DEV: lobby`);

    for (const key of Object.keys(playerLobby)) {
      if (lobby[key] !== undefined) {
        playerLobby[key] = lobby[key];

        console.debug(
          `DEV: Changed lobby.${key} to ${JSON.stringify(lobby[key])}`
        );
      }
    }

    playerLobby.synchronize();
  });

  client.on("devChangeTasks", () => {
    if (!config.devMode) {
      client.emit("error", { error: "Действия разработчика отключены." });
      return;
    }
    if (currentPlayer == null || playerLobby == null) return;

    if (isStaleSocket()) {
      console.debug(`Rejected devChangeTasks from stale socket`);
      return;
    }

    currentPlayer.assignTasks();
    playerLobby.synchronize();
  });

  client.on("restartLobby", () => {
    throw Error("not implemented");
  });

  client.on(
    "hostAuthenticate",
    ({ gameInfo } = {}, acknowledge = () => {}) => {
      const lobby = getLobby(gameInfo?.lobbyId);
      const player = lobby?.players?.[gameInfo?.color];
      const isCreatorSession =
        lobby != null &&
        player != null &&
        player.id === gameInfo?.playerId &&
        player.name === lobby.creator;

      if (!isCreatorSession) {
        acknowledge({
          success: false,
          message: "Панель доступна только создателю текущего лобби.",
        });
        return;
      }

      client.data.hostLobbyId = lobby.id;
      client.join(getHostAdminRoom(lobby.id));
      acknowledge({
        success: true,
        mode: "host",
        lobbies: [lobby.serializeAdmin()],
      });
    }
  );

  client.on("adminAuthenticate", ({ secret } = {}, acknowledge = () => {}) => {
    if (!config.adminSecret) {
      acknowledge({ success: false, message: "Панель ведущего отключена. Настройте ADMIN_SECRET." });
      return;
    }
    if (typeof secret !== "string" || secret !== config.adminSecret) {
      acknowledge({ success: false, message: "Неверный секрет ведущего." });
      return;
    }
    client.data.isAdmin = true;
    client.join("protocol-150-admins");
    acknowledge({ success: true, mode: "global", lobbies: getAdminSnapshot() });
  });

  client.on("adminRefresh", (acknowledge = () => {}) => {
    if (!client.data.isAdmin && !client.data.hostLobbyId) {
      acknowledge({ success: false, message: "Требуется вход в панель ведущего." });
      return;
    }
    acknowledge({ success: true, lobbies: visibleAdminLobbies() });
  });

  client.on("adminLogout", () => {
    client.leave("protocol-150-admins");
    if (client.data.hostLobbyId) {
      client.leave(getHostAdminRoom(client.data.hostLobbyId));
    }
    client.data.isAdmin = false;
    client.data.hostLobbyId = null;
  });

  client.on("adminAction", ({ lobbyId, action, ...info } = {}, acknowledge = () => {}) => {
    if (!canManageLobby(lobbyId)) {
      acknowledge({ success: false, message: "Нет прав на управление этим лобби." });
      return;
    }
    const lobby = getLobby(lobbyId);
    if (lobby == null) {
      acknowledge({ success: false, message: "Лобби не найдено." });
      return;
    }

    let result;
    switch (action) {
      case "setPlayerStatus":
        result = lobby.adminSetPlayerStatus(info.color, info.status);
        break;
      case "setPlayerRole":
        result = lobby.adminSetPlayerRole(info.color, info.role);
        break;
      case "setPaused":
        result = lobby.adminSetPaused(info.active);
        break;
      case "removeDisconnectedPlayer":
        result = lobby.adminRemoveDisconnectedPlayer(info.color);
        break;
      case "advancePhase":
        result = lobby.adminAdvancePhase();
        break;
      case "clearFirewall":
        result = lobby.adminClearFirewall();
        break;
      case "clearSabotage":
        result = lobby.adminClearSabotage();
        break;
      case "setTestMode":
        result = lobby.adminSetTestMode(info.enabled);
        break;
      case "prepareTestLobby":
        result = lobby.adminPrepareTestLobby(info.botCount);
        break;
      case "addTestPlayers":
        result = lobby.adminAddTestPlayers(info.count);
        break;
      case "removeTestPlayers":
        result = lobby.adminRemoveTestPlayers();
        break;
      case "startTestGame":
        result = lobby.adminStartTestGame();
        break;
      case "resetGame":
        result = lobby.adminResetGame();
        break;
      case "resetCooldowns":
        result = lobby.adminResetCooldowns();
        break;
      case "addTaskProgress":
        result = lobby.adminAddTaskProgress();
        break;
      case "callMeeting":
        result = lobby.adminCallMeeting();
        break;
      case "launchSabotage":
        result = lobby.adminLaunchSabotage(info.kind);
        break;
      case "endGame":
        result = lobby.forceEndGame(info.victors, "Игра завершена ведущим");
        break;
      default:
        result = [false, "Неизвестное действие ведущего"];
    }
    acknowledge(
      result[0]
        ? { success: true, lobbies: visibleAdminLobbies() }
        : { success: false, message: result[1] }
    );
  });
});

console.debug(`Listening on http://localhost:${config.port}`);

server.listen(config.port);

function flushAndExit() {
  flushLobbiesToDisk();
  process.exit(0);
}

process.once("SIGINT", flushAndExit);
process.once("SIGTERM", flushAndExit);
