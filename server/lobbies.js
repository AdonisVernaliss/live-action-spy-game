import { nanoid } from "nanoid";
import {
  ACTIVE_EFFECTS_BASE,
  EMERGENCY_MEETINGS_PER_PLAYER,
  FIREWALL_COOLDOWN,
  FIREWALL_FIX_TIME,
  KILL_COOLDOWN_SECS,
  MAX_PLAYERS,
  MEETING_BUTTON_CD,
  MEETING_TIME,
  NFC_ACTIVITIES,
  NFC_ACTIVITY_TAGS,
  PLAYER_SYNC_DURATION_MS,
  PLAYER_SYNC_REQUEST_TIMEOUT_MS,
  PLAYER_COLORS,
  ROLE_DISPLAY_SECS,
  SABO_COOLDOWN_SECS,
  TASK_PROGRESSION_VICTORY_AMOUNT,
  TASK_PROGRESS_DISPLAY_THRESHOLD,
  TEST_MODE_MIN_PLAYERS,
  TEST_MODE_TIMERS,
  VOTE_RESULT_DISPLAY_SECS,
  VIRUS_SCAN_FAILED_PUNISH_SECS,
  VIRUS_SCAN_COOLDOWN,
  VIRUS_SCAN_PREPARE_SECS,
  VIRUS_SCAN_TIME,
} from "./consts.js";
import { io } from "./socketio.js";
import { Player, randomPlayerColor } from "./player.js";
import { randInt } from "./util.js";
import {
  flushLobbyStateWrite,
  readPersistedLobbyState,
  scheduleLobbyStateWrite,
} from "./persistence.js";

// Mapping of lobbyId -> lobby
const lobbies = {};
const PREFLIGHT_ACTIVITY_TAGS = new Set(Object.values(NFC_ACTIVITY_TAGS));

export class Lobby {
  constructor({
    id,
    players,
    creator,
    status,
    pause = null,
    lastImpostorColors = [],
  }) {
    this.id = id;
    this.players = players;
    this.creator = creator;
    this.status = status;
    this.taskProgression = { real: 0, displayed: 0 };
    this.tasksToWin = 34;
    this.singleTaskProgressionAmount = TASK_PROGRESSION_VICTORY_AMOUNT / this.tasksToWin;
    this.activities = null;
    this.activeEffects = { ...ACTIVE_EFFECTS_BASE };
    this.testMode = { enabled: false };
    this.pause = pause ?? { active: false, startedAt: null };
    this._lobbyDeleteTimeout = null;
    this._impostorCdInterval = null;
    this._phaseInterval = null;
    this._virusScanActiveUntil = 0;
    this._virusScanTargets = new Set();
    this._preflightChecks = {};
    this._playerSyncRequests = new Map();
    this._playerSyncRequestTimers = new Map();
    this._playerSyncSessions = new Map();
    this._playerSyncSessionTimers = new Map();
    this._eventLog = [];
    this._lastImpostorColors = new Set(
      Array.isArray(lastImpostorColors) ? lastImpostorColors : []
    );
    this._destroyed = false;
  }

  // Emit the current lobby status to all players in the lobby
  synchronize() {
    if (this._destroyed) return;
    for (const player of Object.values(this.players)) {
      io.to(player.id).emit("lobbyUpdate", {
        lobby: this.serializeForPlayer(player.color),
      });
    }
    broadcastAdminSnapshot();
    scheduleLobbiesPersistence();
  }

  // A light-weight synchronize that synchronizes ONLY the current countdown.
  // If the current lobby status does not have a countdown, this does nothing.
  synchronizeCountDown() {
    if (this._destroyed) return;
    if (this.status.countDown != null)
      io.to(this.id).emit("countDown", { count: this.status.countDown });
    broadcastAdminSnapshot();
    scheduleLobbiesPersistence();
  }

  synchronizeCooldowns() {
    if (this._destroyed) return;
    const cooldowns = this.#getImpostors().reduce((cds, impostor) => {
      cds[impostor.color] = {
        killCooldown: impostor.role.killCooldown,
        sabotageCooldown: impostor.role.sabotageCooldown,
      };
      return cds;
    }, {});
    let firewall = null;
    if (this.activeEffects.firewallBreach != null) {
      firewall = this.activeEffects.firewallBreach.countDown;
    }

    for (const player of Object.values(this.players)) {
      const ownCooldown = cooldowns[player.color];
      io.to(player.id).emit("cooldownUpdate", {
        cooldowns: ownCooldown ? { [player.color]: ownCooldown } : {},
        firewall,
      });
    }
    broadcastAdminSnapshot();
    scheduleLobbiesPersistence();
  }

  participatingPlayers() {
    return Object.values(this.players).filter((player) => !player.isHostOnly);
  }

  nParticipatingPlayers() {
    return this.participatingPlayers().length;
  }

  allParticipatingPlayersReadyExcept(excludedColor = null) {
    if (this.status.state !== "inLobby") return false;

    return this.participatingPlayers().every(
      (player) =>
        player.color === excludedColor ||
        this.status.readyPlayers[player.color] === true
    );
  }

  // Start the game for this lobby. Will decide a role for each player and show
  // them information about this role for `ROLE_DISPLAY_SECS`, then start the actual game.
  startGame() {
    this.pause = { active: false, startedAt: null };
    this.#clearPlayerSyncInteractions();
    this.#assignTasks();
    this.#assignRolesRandomly();
    this.#configureTaskScaling();
    const roleDisplaySeconds = this.testMode.enabled
      ? TEST_MODE_TIMERS.roleDisplay
      : ROLE_DISPLAY_SECS;
    this.status = { state: "roleExplanation", countDown: roleDisplaySeconds };
    this.recordEvent("game_started", "Игра началась, роли назначены");
    this.synchronize();

    this.#startPhaseCountdown("roleExplanation", () => this.#startNewRound());
  }

  // Start a meeting call for a certain `type` of meeting: "emergency" or "bodyFound"
  // The color of the player that called the meeting must be passed in `initiatorColor`.
  startMeetingCall(type, initiatorColor, deadPlayer = null) {
    // Meetings can only be called when the game is running
    if (this.status.state !== "started") return;
    if (type !== "emergency" && type !== "bodyFound")
      throw Error(`Meeting type invalid: ${type}`);
    if (this.players[initiatorColor]?.isHostOnly) return;
    this.#clearPlayerSyncInteractions();
    this.status = {
      state: "meetingCalled",
      type,
      presentPlayers: {},
      caller: initiatorColor,
      deadPlayer,
    };
    // If the meeting is an emergency meeting, the initiator just scanned
    // the meeting point, and is therefore already present.
    if (type === "emergency") this.status.presentPlayers[initiatorColor] = true;

    // A meeting interrupts personal activities. Tasks remain uncompleted and can
    // be restarted after the meeting. Timed sabotage is paused by the cooldown loop.
    for (const player of Object.values(this.players)) {
      player.currentlyDoing = { activity: "nothing" };
    }
    this.activeEffects.hacked = null;
    this._virusScanActiveUntil = 0;
    this._virusScanTargets.clear();
    this.recordEvent(
      "meeting_called",
      `${type === "emergency" ? "Экстренное собрание" : "Собрание по найденному телу"} созвано игроком ${this.players[initiatorColor]?.name || initiatorColor}`
    );

    this.synchronize();
  }

  addPlayerToMeeting(playerColor) {
    if (this.status.state !== "meetingCalled")
      return [false, "Сейчас не идёт сбор на собрание"];

    const player = this.players[playerColor];

    // Dead or unknown players should not be required for meeting start.
    if (player == null || player.status !== "alive" || player.isHostOnly) {
      return [false, "На собрание могут войти только живые игроки"];
    }

    const presentPlayers = this.status.presentPlayers;
    presentPlayers[playerColor] = true;

    const nPresentAlivePlayers = Object.entries(presentPlayers).reduce(
      (total, [color, present]) => {
        const player = this.players[color];
        return present && player?.status === "alive" && !player.isHostOnly
          ? total + 1
          : total;
      },
      0
    );

    if (nPresentAlivePlayers >= this.nMeetingAttendees()) {
      this.startMeeting();
    } else {
      this.synchronize();
    }

    return [true];
  }

  // Start a meeting in this lobby, depending on which type of meeting was previously called.
  // After the meeting is done, this method will then start the vote
  startMeeting() {
    if (this.status.state !== "meetingCalled")
      throw Error(
        `Cannot start a meeting: No meeting was called beforehand. Lobby status was ${this.status.state}`
      );
    const votes = this.participatingPlayers().reduce((votes, player) => {
      if (player.status === "alive") votes[player.color] = "noVote";
      return votes;
    }, {});
    this.status = {
      state: "meeting",
      type: this.status.type,
      countDown: this.testMode.enabled ? TEST_MODE_TIMERS.meeting : MEETING_TIME,
      votes,
      caller: this.status.caller,
      nVoters: this.nAlivePlayers(),
    };

    this.synchronize();
    this.#startPhaseCountdown("meeting", () => this.#stopVote());
  }

  killVotedOutPlayer(targetColor) {
    const target = this.players[targetColor];
    if (target?.isHostOnly) {
      return [false, "Ведущий не участвует в голосовании"];
    } else if (target != null) {
      target.status = "foundDead";
      this.synchronize();
      return [true];
    } else {
      return [
        false,
        `Player with color ${targetColor} was not found in lobby ${this.id}`,
      ];
    }
  }

  reportDeadBody(reporterColor, bodyColor) {
    if (this.status.state !== "started") {
      return [false, "Игра не запущена"];
    }

    const reporter = this.players[reporterColor];
    const body = this.players[bodyColor];

    if (reporter == null) {
      return [false, `Reporter with color ${reporterColor} was not found`];
    }

    if (body == null) {
      return [false, `Body with color ${bodyColor} was not found`];
    }

    if (reporter.isHostOnly || body.isHostOnly) {
      return [false, "Ведущий не участвует в игровых действиях"];
    }

    if (reporterColor === bodyColor) {
      return [false, "Игрок не может сообщить о собственном теле"];
    }

    if (reporter.status !== "alive") {
      return [false, "Погибшие игроки не могут сообщать о телах"];
    }

    if (body.status !== "dead") {
      return [false, "Этот игрок не является доступным для обнаружения телом"];
    }

    // Prevent the same body from being reported multiple times.
    body.status = "foundDead";

    this.startMeetingCall("bodyFound", reporterColor, bodyColor);

    return [true];
  }

  killPlayer(targetColor, killerColor) {
    if (this.status.state !== "started") {
      return [false, "Игра не запущена"];
    }

    const killer = this.players[killerColor];
    const target = this.players[targetColor];

    if (killer == null) {
      return [false, `Killer with color ${killerColor} was not found`];
    }

    if (target == null) {
      return [false, `Target with color ${targetColor} was not found`];
    }


    if (killer.isHostOnly || target.isHostOnly) {
      return [false, "Ведущий не участвует в игровых действиях"];
    }

    if (killerColor === targetColor) {
      return [false, "Нельзя устранить самого себя"];
    }

    if (killer.status !== "alive") {
      return [false, "Погибшие игроки не могут устранять других"];
    }

    if (target.status !== "alive") {
      return [false, "Цель уже не жива"];
    }

    if (killer.role.name !== "impostor") {
      return [false, "Устранять игроков могут только внедрённые агенты"];
    }

    if (killer.role.killCooldown > 0) {
      return [false, `Способность восстанавливается: ${killer.role.killCooldown} сек.`];
    }

    target.status = "dead";
    this.recordEvent(
      "player_killed",
      `${target.name} устранён игроком ${killer.name}`
    );

    const [victors, reason] = this.#determineVictors();

    if (victors != null) {
      this.#endGame(victors, reason);
      return [true];
    }

    killer.role.killCooldown = this.testMode.enabled
      ? TEST_MODE_TIMERS.killCooldown
      : KILL_COOLDOWN_SECS;
    this.synchronize();

    return [true];
  }

  requestPlayerSync(scannerColor, targetColor, mode = "sync") {
    if (this.status.state !== "started") {
      return [false, "Синхронизация доступна только во время активного раунда"];
    }
    if (this.pause.active) return [false, "Игра поставлена на паузу"];
    if (mode !== "sync" && mode !== "eliminate") {
      return [false, "Неизвестный режим синхронизации"];
    }

    const scanner = this.players[scannerColor];
    const target = this.players[targetColor];
    if (scanner == null || target == null) return [false, "Игрок не найден"];
    if (scanner.isHostOnly || target.isHostOnly) {
      return [false, "Ведущий не участвует в синхронизации"];
    }
    if (scannerColor === targetColor) {
      return [false, "Нельзя синхронизироваться с самим собой"];
    }
    if (scanner.status !== "alive" || target.status !== "alive") {
      return [false, "Синхронизация доступна только живым игрокам"];
    }

    if (mode === "eliminate") {
      if (scanner.role.name !== "impostor") {
        return [false, "Секретное действие недоступно"];
      }
      if (scanner.role.killCooldown > 0) {
        return [false, `Способность восстанавливается: ${scanner.role.killCooldown} сек.`];
      }
      if (target.role.name === "impostor") {
        return [false, "Нельзя устранить другого внедрённого агента"];
      }
    }

    const sameRequest = [...this._playerSyncRequests.values()].find(
      (request) =>
        request.fromColor === scannerColor && request.toColor === targetColor
    );
    if (sameRequest != null) {
      sameRequest.mode = mode;
      this.synchronize();
      return [true];
    }

    const reverseRequest = [...this._playerSyncRequests.values()].find(
      (request) =>
        request.fromColor === targetColor && request.toColor === scannerColor
    );
    if (reverseRequest != null) {
      if (scanner.currentlyDoing.activity !== "nothing") {
        return [false, "Сначала завершите текущее действие"];
      }
      if (
        target.currentlyDoing.activity !== "awaitingSync" ||
        target.currentlyDoing.requestId !== reverseRequest.id
      ) {
        this.#removePlayerSyncRequest(reverseRequest.id);
        return [false, "Запрос синхронизации уже недействителен"];
      }

      this.#removePlayerSyncRequest(reverseRequest.id);
      const covertAction = mode === "eliminate"
        ? { killerColor: scannerColor, victimColor: targetColor }
        : reverseRequest.mode === "eliminate"
          ? {
              killerColor: reverseRequest.fromColor,
              victimColor: reverseRequest.toColor,
            }
          : null;
      return this.#startPlayerSyncSession(
        reverseRequest.fromColor,
        reverseRequest.toColor,
        covertAction
      );
    }

    const activeSession = [...this._playerSyncSessions.values()].find(
      (session) => session.colors.includes(scannerColor) || session.colors.includes(targetColor)
    );
    if (activeSession != null) {
      return [false, "Один из игроков уже синхронизируется"];
    }

    const conflictingRequest = [...this._playerSyncRequests.values()].find(
      (request) =>
        request.fromColor === scannerColor ||
        request.toColor === scannerColor ||
        request.fromColor === targetColor ||
        request.toColor === targetColor
    );
    if (conflictingRequest != null) {
      return [false, "Один из игроков уже ожидает другую синхронизацию"];
    }
    if (scanner.currentlyDoing.activity !== "nothing") {
      return [false, "Сначала завершите текущее действие"];
    }
    if (target.currentlyDoing.activity !== "nothing") {
      return [false, "Этот игрок сейчас занят другим действием"];
    }

    const covertAction = mode === "eliminate"
      ? { killerColor: scannerColor, victimColor: targetColor }
      : null;

    // Simulated players stand in for a second phone in the host test mode.
    if (target.isSimulated) {
      return this.#startPlayerSyncSession(scannerColor, targetColor, covertAction);
    }

    const request = {
      id: nanoid(10),
      fromColor: scannerColor,
      toColor: targetColor,
      mode,
      createdAt: Date.now(),
      expiresAt: Date.now() + PLAYER_SYNC_REQUEST_TIMEOUT_MS,
    };
    this._playerSyncRequests.set(request.id, request);
    scanner.currentlyDoing = {
      activity: "awaitingSync",
      requestId: request.id,
      targetColor,
    };

    const timer = setTimeout(() => {
      if (!this._playerSyncRequests.has(request.id)) return;
      this.#removePlayerSyncRequest(request.id);
      this.recordEvent(
        "player_sync_expired",
        `Запрос синхронизации ${scanner.name} и ${target.name} истёк`
      );
      this.synchronize();
    }, PLAYER_SYNC_REQUEST_TIMEOUT_MS);
    timer.unref?.();
    this._playerSyncRequestTimers.set(request.id, timer);

    this.recordEvent(
      "player_sync_requested",
      `${scanner.name} запросил синхронизацию с ${target.name}`
    );
    this.synchronize();
    return [true];
  }

  cancelPlayerSync(playerColor) {
    const session = [...this._playerSyncSessions.values()].find((candidate) =>
      candidate.colors.includes(playerColor)
    );
    if (session != null) {
      return [false, "Запущенную синхронизацию нельзя отменить"];
    }

    const request = [...this._playerSyncRequests.values()].find(
      (candidate) =>
        candidate.fromColor === playerColor || candidate.toColor === playerColor
    );
    if (request == null) return [false, "Активный запрос не найден"];

    this.#removePlayerSyncRequest(request.id);
    this.recordEvent("player_sync_cancelled", "Запрос синхронизации отменён");
    this.synchronize();
    return [true];
  }

  finishPlayerSync(sessionId) {
    const session = this._playerSyncSessions.get(sessionId);
    if (session == null) return [false, "Синхронизация уже завершена"];

    const timer = this._playerSyncSessionTimers.get(sessionId);
    if (timer != null) clearTimeout(timer);
    this._playerSyncSessionTimers.delete(sessionId);
    this._playerSyncSessions.delete(sessionId);

    const [firstColor, secondColor] = session.colors;
    const first = this.players[firstColor];
    const second = this.players[secondColor];
    for (const player of [first, second]) {
      if (
        player?.currentlyDoing.activity === "playerSync" &&
        player.currentlyDoing.sessionId === sessionId
      ) {
        player.currentlyDoing = { activity: "nothing" };
      }
    }

    if (
      this.status.state !== "started" ||
      this.pause.active ||
      first?.status !== "alive" ||
      second?.status !== "alive"
    ) {
      this.synchronize();
      return [false, "Синхронизация была прервана"];
    }

    if (session.covertAction != null) {
      const killer = this.players[session.covertAction.killerColor];
      const victim = this.players[session.covertAction.victimColor];
      if (killer != null && victim != null) {
        killer.completeSyncTask(victim.color);
      }
      return this.killPlayer(
        session.covertAction.victimColor,
        session.covertAction.killerColor
      );
    }

    first.completeSyncTask(second.color);
    second.completeSyncTask(first.color);
    this.recordEvent(
      "player_sync_completed",
      `${first.name} и ${second.name} завершили синхронизацию`
    );
    this.synchronize();
    return [true];
  }

  #startPlayerSyncSession(firstColor, secondColor, covertAction) {
    const first = this.players[firstColor];
    const second = this.players[secondColor];
    if (first == null || second == null) return [false, "Игрок не найден"];

    const durationMs = this.testMode.enabled
      ? TEST_MODE_TIMERS.playerSyncDurationMs
      : PLAYER_SYNC_DURATION_MS;
    const startedAt = Date.now();
    const session = {
      id: nanoid(10),
      colors: [firstColor, secondColor],
      startedAt,
      endsAt: startedAt + durationMs,
      durationMs,
      covertAction,
    };
    this._playerSyncSessions.set(session.id, session);
    first.currentlyDoing = {
      activity: "playerSync",
      sessionId: session.id,
      partnerColor: secondColor,
    };
    second.currentlyDoing = {
      activity: "playerSync",
      sessionId: session.id,
      partnerColor: firstColor,
    };

    const timer = setTimeout(() => this.finishPlayerSync(session.id), durationMs);
    timer.unref?.();
    this._playerSyncSessionTimers.set(session.id, timer);
    this.recordEvent(
      "player_sync_started",
      `${first.name} и ${second.name} начали синхронизацию`
    );
    this.synchronize();
    return [true];
  }

  #removePlayerSyncRequest(requestId) {
    const request = this._playerSyncRequests.get(requestId);
    const timer = this._playerSyncRequestTimers.get(requestId);
    if (timer != null) clearTimeout(timer);
    this._playerSyncRequestTimers.delete(requestId);
    this._playerSyncRequests.delete(requestId);

    if (request != null) {
      const requester = this.players[request.fromColor];
      if (
        requester?.currentlyDoing.activity === "awaitingSync" &&
        requester.currentlyDoing.requestId === requestId
      ) {
        requester.currentlyDoing = { activity: "nothing" };
      }
    }
  }

  #removePlayerSyncSession(sessionId) {
    const session = this._playerSyncSessions.get(sessionId);
    const timer = this._playerSyncSessionTimers.get(sessionId);
    if (timer != null) clearTimeout(timer);
    this._playerSyncSessionTimers.delete(sessionId);
    this._playerSyncSessions.delete(sessionId);
    if (session == null) return;

    for (const color of session.colors) {
      const player = this.players[color];
      if (
        player?.currentlyDoing.activity === "playerSync" &&
        player.currentlyDoing.sessionId === sessionId
      ) {
        player.currentlyDoing = { activity: "nothing" };
      }
    }
  }

  #clearPlayerSyncInteractions() {
    for (const requestId of [...this._playerSyncRequests.keys()]) {
      this.#removePlayerSyncRequest(requestId);
    }
    for (const sessionId of [...this._playerSyncSessions.keys()]) {
      this.#removePlayerSyncSession(sessionId);
    }
  }

  #playerSyncView(playerColor) {
    const player = this.players[playerColor];
    if (player == null) return { state: "required" };

    const session = [...this._playerSyncSessions.values()].find((candidate) =>
      candidate.colors.includes(playerColor)
    );
    if (session != null) {
      const partnerColor = session.colors.find((color) => color !== playerColor);
      return {
        state: "active",
        sessionId: session.id,
        partnerColor,
        partnerName: this.players[partnerColor]?.name || partnerColor,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        durationMs: session.durationMs,
      };
    }

    const outgoing = [...this._playerSyncRequests.values()].find(
      (request) => request.fromColor === playerColor
    );
    if (outgoing != null) {
      return {
        state: "waiting",
        partnerColor: outgoing.toColor,
        partnerName: this.players[outgoing.toColor]?.name || outgoing.toColor,
        expiresAt: outgoing.expiresAt,
      };
    }

    const incoming = [...this._playerSyncRequests.values()].find(
      (request) => request.toColor === playerColor
    );
    if (incoming != null) {
      return {
        state: "incoming",
        partnerColor: incoming.fromColor,
        partnerName: this.players[incoming.fromColor]?.name || incoming.fromColor,
        expiresAt: incoming.expiresAt,
      };
    }

    if (player.syncTask?.completed) {
      return {
        state: "completed",
        partnerColor: player.syncTask.partnerColor ?? null,
        completedAt: player.syncTask.completedAt ?? null,
      };
    }
    return { state: "required" };
  }

  addReady(playerColor) {
    if (this.status.state !== "inLobby")
      return [false, `Players cannot become ready while the game is in state ${this.status.state}`];
    if (this.players[playerColor] == null)
      return [false, "Игрок не найден в лобби"];
    if (this.players[playerColor].isHostOnly)
      return [false, "Ведущему не требуется подтверждать готовность"];
    if (this.status.readyPlayers[playerColor])
      return [false, "Игрок уже готов"];
    this.status.readyPlayers[playerColor] = true;
    this.synchronize();
    return [true];
  }

  addVote(voterColor, vote) {
    if (this.status.state !== "meeting") {
      return [false, "В лобби сейчас нет собрания"];
    }

    const voter = this.players[voterColor];

    if (voter == null) {
      return [false, `Voter with color ${voterColor} was not found`];
    }


    if (voter.isHostOnly) {
      return [false, "Ведущий не участвует в голосовании"];
    }

    if (voter.status !== "alive") {
      return [false, "Погибшие игроки не могут голосовать"];
    }

    if (this.status.votes[voterColor] == null) {
      return [false, "Этот игрок не участвует в голосовании"];
    }

    if (this.status.votes[voterColor] !== "noVote") {
      return [false, "Игрок уже проголосовал"];
    }

    if (vote !== "skip") {
      const target = this.players[vote];

      if (target == null) {
        return [false, `Vote target ${vote} was not found`];
      }


      if (target.isHostOnly) {
        return [false, "Нельзя голосовать за ведущего"];
      }

      if (target.status !== "alive") {
        return [false, "Нельзя голосовать за погибшего игрока"];
      }
    }

    this.status.votes[voterColor] = vote;
    this.recordEvent("vote_cast", `${voter.name} отправил голос`);
    this.synchronize();

    const allVotesSubmitted = Object.values(this.status.votes).every(
      (submittedVote) => submittedVote !== "noVote"
    );
    if (allVotesSubmitted) this.#stopVote();

    return [true];
  }

  // Total number of players, both impostors and crew, that are not dead
  nAlivePlayers() {
    return this.participatingPlayers().reduce(
      (n, player) => (player.status === "alive" ? n + 1 : n),
      0
    );
  }

  // Number of alive players that need to attend the next meeting.
  // Dead players can see the meeting screen, but they must not block the meeting start.
  nMeetingAttendees() {
    return this.participatingPlayers().reduce(
      (n, player) => (player.status === "alive" ? n + 1 : n),
      0
    );
  }

  // Sets the list of activities with their rooms for this lobby
  setActivities(activities) {
    if (this.status.state !== "settingRooms")
      return [false, "Настройка площадки уже завершена"];

    if (activities == null || typeof activities !== "object") {
      return [false, "Конфигурация площадки отсутствует или повреждена."];
    }

    const normalizedActivities = {};
    for (const [index, name] of NFC_ACTIVITIES.entries()) {
      const rawRoom = activities[name]?.room;
      const room = typeof rawRoom === "string" ? rawRoom.trim() : "";
      if (room.length < 1 || room.length > 80) {
        return [false, `Локация для ${name} не указана или слишком длинная.`];
      }
      normalizedActivities[name] = { id: index + 1, name, room };
    }

    this.activities = normalizedActivities;
    this._preflightChecks = {};
    this.status = { state: "inLobby", readyPlayers: {} };
    this.recordEvent(
      "venue_configured",
      `Площадка настроена: ${NFC_ACTIVITIES.length} точек`
    );
    this.synchronize();
    return [true];
  }

  recordPreflightCheck(tag, method, player) {
    const isActivityTag =
      typeof tag === "string" && PREFLIGHT_ACTIVITY_TAGS.has(tag);
    const isPlayerTag =
      typeof tag === "string" &&
      tag.startsWith("player:") &&
      PLAYER_COLORS.includes(tag.slice("player:".length));

    if (!isActivityTag && !isPlayerTag) {
      return [false, "Неизвестная точка проверки площадки"];
    }
    if (method !== "qr" && method !== "nfc") {
      return [false, "Неизвестный способ проверки площадки"];
    }

    const checkedAt = new Date().toISOString();
    const current = this._preflightChecks[tag] ?? {};
    current[method] = {
      checkedAt,
      playerColor: player?.color ?? null,
      playerName: player?.name ?? null,
    };
    this._preflightChecks[tag] = current;
    this.recordEvent(
      "preflight_check",
      `${method === "qr" ? "QR" : "NFC"} проверен: ${tag}`
    );
    broadcastAdminSnapshot();
    scheduleLobbiesPersistence();
    return [true, { tag, method, checkedAt }];
  }

  clearPreflightChecks() {
    this._preflightChecks = {};
    this.recordEvent("preflight_check", "Проверки площадки сброшены ведущим");
    broadcastAdminSnapshot();
    scheduleLobbiesPersistence();
    return [true];
  }

  launchSabotage(impostorColor, sabotage) {
    if (this.pause.active) {
      return [false, "Игра поставлена на паузу"];
    }
    if (this.status.state !== "started") {
      return [false, "Игра не запущена"];
    }

    const impostor = this.players[impostorColor];

    if (impostor == null) {
      return [false, `Impostor with color ${impostorColor} was not found`];
    }

    if (impostor.status !== "alive") {
      return [false, "Погибшие агенты не могут запускать саботаж"];
    }

    if (impostor.role.name !== "impostor") {
      return [false, "Саботаж доступен только внедрённым агентам"];
    }

    if (impostor.role.sabotageCooldown > 0) {
      return [
        false,
        `Саботаж восстанавливается: ${impostor.role.sabotageCooldown} сек.`,
      ];
    }

    if (sabotage == null || typeof sabotage !== "object") {
      return [false, "Некорректные данные саботажа"];
    }

    const { kind } = sabotage;

    if (this._virusScanActiveUntil <= Date.now()) {
      this._virusScanActiveUntil = 0;
      this._virusScanTargets.clear();
    }

    if (
      this.activeEffects.firewallBreach != null ||
      this._virusScanActiveUntil > Date.now()
    ) {
      return [false, "Другой саботаж уже активен"];
    }

    switch (kind) {
      case "firewallBreach":
        return this.#startFirewallBreach(impostorColor);

      case "virusScan":
        return this.#startVirusScan(impostorColor);

      case "hackPlayer":
        return [false, "Взлом игрока пока недоступен"];

      default:
        return [false, `Неизвестный вид саботажа: ${String(kind)}`];
    }
  }

  applyVirusPenalty(playerColor) {
    if (this.pause.active) {
      return [false, "Игра поставлена на паузу"];
    }
    if (this.status.state !== "started") {
      return [false, "Вирусная проверка недоступна вне активного раунда"];
    }

    if (
      this._virusScanActiveUntil <= Date.now() ||
      !this._virusScanTargets.has(playerColor)
    ) {
      return [false, "Для этого игрока нет активной вирусной проверки"];
    }

    const player = this.players[playerColor];
    if (player == null || player.status !== "alive" || player.role.name !== "crew") {
      return [false, "Наказание вирусной проверки неприменимо"];
    }

    player.lockTasks(VIRUS_SCAN_FAILED_PUNISH_SECS);
    this._virusScanTargets.delete(playerColor);
    this.recordEvent(
      "virus_penalty",
      `${player.name} двигался во время вирусной проверки`
    );
    this.synchronize();
    return [true];
  }

  // Increase the taskbar with the completion of a single task
  // If the display value for the task bar is updated, it will happen after a random delay
  increaseTaskBar() {
    this.taskProgression.real += this.singleTaskProgressionAmount;

    if (this.taskProgression.real > TASK_PROGRESSION_VICTORY_AMOUNT) {
      this.taskProgression.real = TASK_PROGRESSION_VICTORY_AMOUNT;
    }

    this.taskProgression.displayed = this.taskProgression.real;

    console.debug(
      `Task progress increased: ${this.taskProgression.displayed.toFixed(2)}%`
    );

    this.synchronize();

    if (this.taskProgression.real >= TASK_PROGRESSION_VICTORY_AMOUNT) {
      return this.#endGame("crew", "Все задания выполнены");
    }
  }

  reconnectPlayer(color, id, client) {
    if (this.players[color] == null || this.players[color].id !== id) {
      console.error(`Player ${color} tried to reconnect but id did not match`);
      return;
    }
    this.players[color].connection = "connected";

    if (this._lobbyDeleteTimeout != null) {
      clearTimeout(this._lobbyDeleteTimeout);
      this._lobbyDeleteTimeout = null;
      console.debug(
        `Lobby ${this.id} no longer scheduled for deletion because player reconnected`
      );
    }
    return this.players[color];
  }

  // Mark player as disconnected from the lobby.
  // If all players are disconnected also remove the lobby.
  // If player does not exist in this lobby, returns `null` if there is no lobby (anymore), else returns the lobby.
  disconnectPlayer(playerColor) {
    if (playerColor == null || this.players[playerColor] == null) {
      console.debug(
        `Unknown player disconnected from lobby ${this.id}; ignoring`
      );
      return this;
    }

    console.debug(
      `Player ${this.players[playerColor].name} disconnected from lobby ${this.id}`
    );

    this.players[playerColor].connection = "disconnected";

    const nConnectedPlayers = this.nConnectedPlayers();

    this.synchronize();

    // Remove lobby entirely after 30 minutes if all players are disconnected.
    // Phones may lock, refresh, lose Wi-Fi, or unload the browser tab,
    // so 1 minute is too aggressive for a live party game.
    if (nConnectedPlayers === 0) {
      console.debug(
        `Lobby ${this.id} scheduled for deletion because it has no connected players left`
      );
      this.scheduleDeletionIfAbandoned();

      return null;
    }

    return this;
  }

  nConnectedPlayers() {
    return Object.values(this.players).filter(
      (player) => player.connection === "connected"
    ).length;
  }

  scheduleDeletionIfAbandoned() {
    if (this._lobbyDeleteTimeout != null || this.nConnectedPlayers() > 0) return;

    this._lobbyDeleteTimeout = setTimeout(() => {
      if (this.nConnectedPlayers() !== 0) return;
      const storedLobby = lobbies[this.id];
      if (storedLobby == null) return;
      storedLobby.destroy();
      delete lobbies[this.id];
      scheduleLobbiesPersistence();
      console.log(`Deleted lobby ${this.id}`);
    }, 30 * 60 * 1000);
    this._lobbyDeleteTimeout.unref?.();
  }

  // `buttonNumber` is 0 or 1
  pressFirewallButton(buttonNumber) {
    const breach = this.activeEffects.firewallBreach;

    if (breach == null) {
      return [false, "Активного взлома защиты нет"];
    }

    if (buttonNumber === 0) {
      breach.buttonsPressed.firewallbutton1 = true;
    } else if (buttonNumber === 1) {
      breach.buttonsPressed.firewallbutton2 = true;
    } else {
      return [false, `Invalid firewall button number: ${buttonNumber}`];
    }

    if (
      breach.buttonsPressed.firewallbutton1 &&
      breach.buttonsPressed.firewallbutton2
    ) {
      this.#endFirewallBreach();
    }

    this.synchronize();

    return [true];
  }

  #startVirusScan(impostorColor) {
    const impostor = this.players[impostorColor];

    if (impostor == null || impostor.role.name !== "impostor") {
      return [false, "Недопустимый внедрённый агент"];
    }

    impostor.role.sabotageCooldown = this.testMode.enabled
      ? TEST_MODE_TIMERS.sabotageCooldown
      : VIRUS_SCAN_COOLDOWN;

    this._virusScanTargets = new Set(
      Object.values(this.players)
        .filter(
          (player) =>
            player.status === "alive" &&
            player.role.name === "crew" &&
            player.currentlyDoing.activity === "nothing"
        )
        .map((player) => player.color)
    );
    this._virusScanActiveUntil =
      Date.now() + (VIRUS_SCAN_PREPARE_SECS + VIRUS_SCAN_TIME + 2) * 1000;

    io.to(this.id).emit("virusScan");
    this.recordEvent(
      "sabotage",
      `Вирусная проверка запущена игроком ${impostor.name}`
    );
    this.synchronize();

    return [true];
  }

  #startFirewallBreach(impostorColor) {
    if (this.activeEffects.firewallBreach != null) {
      return [false, "Взлом защиты уже активен"];
    }

    const impostor = this.players[impostorColor];

    if (impostor == null || impostor.role.name !== "impostor") {
      return [false, "Недопустимый внедрённый агент"];
    }

    this.activeEffects.firewallBreach = {
      buttonsPressed: {
        firewallbutton1: false,
        firewallbutton2: false,
      },
      countDown: this.testMode.enabled
        ? TEST_MODE_TIMERS.firewall
        : FIREWALL_FIX_TIME,
    };

    impostor.role.sabotageCooldown = this.testMode.enabled
      ? TEST_MODE_TIMERS.sabotageCooldown
      : FIREWALL_COOLDOWN;
    this.recordEvent(
      "sabotage",
      `Взлом защиты запущен игроком ${impostor.name}`
    );

    this.synchronize();

    return [true];
  }

  #endFirewallBreach() {
    this.activeEffects.firewallBreach = null;
    for (const player of Object.values(this.players)) {
      if (player.currentlyDoing.activity === "fixFirewall") {
        player.currentlyDoing = { activity: "nothing" };
      }
    }
  }

  // Returns the color the player that should be voted out, or `null` if no player is voted out.
  // No player is voted out if at least half voted to skip, or if there is a tie.
  #determineVoteResult() {
    const { votes } = this.status;
    const nTotalVotes = Object.values(votes).length;
    // Every player that voted skip (`null`) or did not vote, counts as a skip vote
    const nSkipVotes = Object.values(votes).filter(
      (vote) => vote === "skip" || vote === "noVote"
    ).length;

    // At least half voted to skip, thus no one is voted out
    if (nSkipVotes >= Math.ceil(nTotalVotes / 2)) {
      console.log("Vote result: Skip");
      return null;
    }
    // Else, tally the votes
    let votedOutPlayer = null;
    const tally = {};
    // Tally all the votes per player
    for (const vote of Object.values(votes)) {
      if (vote === "noVote") continue;
      if (tally[vote] != null) tally[vote] += 1;
      else tally[vote] = 1;
    }
    // Find the colors of the players with the highest number of votes
    let highestVotePlayers = [];
    let max = 0;
    for (const [color, count] of Object.entries(tally)) {
      // We not only find the max; we also count every player
      // that has this specific max to check for ties later
      if (count > max) {
        max = count;
        highestVotePlayers = [color];
      } else if (count === max) highestVotePlayers.push(color);
    }

    // If only one player has the highest vote count, there are no ties and they are voted out.
    if (highestVotePlayers.length === 1) {
      votedOutPlayer = highestVotePlayers[0];
    }
    console.log(
      `Vote result: ${votedOutPlayer == null ? "no one (tie or skip)" : votedOutPlayer}`
    );
    return votedOutPlayer;
  }

  #assignTasks() {
    for (const player of Object.values(this.players)) {
      if (player.isHostOnly) {
        player.tasks = [];
        player.resetSyncTask(false);
      } else {
        player.assignTasks(this.activities);
        player.resetSyncTask(true);
      }
    }
  }

  #stopVote() {
    if (this.status.state !== "meeting") return;
    this.#clearPhaseInterval();

    const votedOutPlayer = this.#determineVoteResult();
    if (votedOutPlayer != null) {
      this.killVotedOutPlayer(votedOutPlayer);
      const [victors, reason] = this.#determineVictors();
      if (victors != null) {
        this.#endGame(victors, reason);
        return;
      }
    }
    for (const player of Object.values(this.players)) {
      if (player.status === "dead") player.status = "foundDead";
    }

    this.status = {
      state: "voteResultAnnounced",
      votedOutPlayer,
      countDown: this.testMode.enabled
        ? TEST_MODE_TIMERS.voteResult
        : VOTE_RESULT_DISPLAY_SECS,
      votes: this.status.votes,
    };
    this.synchronize();
    this.#startPhaseCountdown("voteResultAnnounced", () => this.#startNewRound());
  }

  // After a vote result has been announced and displayed for VOTE_RESULT_DISPLAY_SECS seconds,
  // a new round starts.
  #startNewRound() {
    this.status = {
      state: "started",
      countDown: this.testMode.enabled
        ? TEST_MODE_TIMERS.meetingButton
        : MEETING_BUTTON_CD,
    };
    this.#setImpostorCooldowns();
    this.synchronize();
    this.#startPhaseCountdown("started");
  }

  // Determine whether the game in its current state should end, and who the victors are.
  // If the game should end, returns ["impostor", reason] or ["crew", reason], else returns [null].
  // Does NOT check for sabotage victories, as these are triggered instantly when the sabotage completes.
  #determineVictors() {
    // Impostors all dead - Crew win
    const impostorsLeft = Object.values(this.players).filter(
      ({ role, status }) => role.name === "impostor" && status === "alive"
    ).length;

    if (impostorsLeft === 0)
      return ["crew", "Все внедрённые агенты устранены"];

    // Equal impostors and crew - Impostors win
    const crewLeft = Object.values(this.players).filter(
      ({ role, status }) => role.name === "crew" && status === "alive"
    ).length;

    if (impostorsLeft >= crewLeft)
      return ["impostor", "Внедрённые агенты получили численное преимущество"];
    return [null];
  }

  // Instantly end the game, with a victory for `victors` ("crew" or "impostor")
  #endGame(victors, reason) {
    if (this.status.state === "gameEnded") return;
    this.#removeGameIntervals();
    this.#clearPlayerSyncInteractions();
    this.activeEffects.firewallBreach = null;
    this.activeEffects.hacked = null;
    this._virusScanActiveUntil = 0;
    this._virusScanTargets.clear();
    this.pause = { active: false, startedAt: null };
    for (const player of Object.values(this.players)) {
      player.currentlyDoing = { activity: "nothing" };
    }
    this.status = { state: "gameEnded", victors, reason };
    this.recordEvent(
      "game_ended",
      `Победили ${victors === "crew" ? "оперативники" : "внедрённые агенты"}. ${reason}`
    );
    this.synchronize();
  }

  recordEvent(type, message) {
    this._eventLog.push({
      id: nanoid(8),
      type,
      message,
      timestamp: new Date().toISOString(),
    });
    if (this._eventLog.length > 100) this._eventLog.shift();
  }

  forceEndGame(victors = "crew", reason = "Игра завершена ведущим") {
    if (victors !== "crew" && victors !== "impostor")
      return [false, "Недопустимый победитель"];
    this.#endGame(victors, reason);
    return [true];
  }

  adminSetPaused(active) {
    if (typeof active !== "boolean") {
      return [false, "Некорректное состояние паузы"];
    }
    if (["settingRooms", "inLobby", "gameEnded"].includes(this.status.state)) {
      return [false, "Пауза доступна только во время матча"];
    }
    if (this.pause.active === active) {
      return [false, active ? "Игра уже на паузе" : "Игра уже продолжается"];
    }

    if (active) {
      this.pause = { active: true, startedAt: Date.now() };
      this.#clearPlayerSyncInteractions();
      for (const player of Object.values(this.players)) {
        player.currentlyDoing = { activity: "nothing" };
      }
      this.recordEvent("game_paused", "Матч поставлен на паузу ведущим");
    } else {
      const pauseStartedAt = this.pause.startedAt || Date.now();
      const pauseDuration = Math.max(0, Date.now() - pauseStartedAt);
      if (this._virusScanActiveUntil > pauseStartedAt) {
        this._virusScanActiveUntil += pauseDuration;
      }
      this.pause = { active: false, startedAt: null };
      this.recordEvent("game_resumed", "Матч продолжен ведущим");
    }

    this.synchronize();
    return [true];
  }

  adminRemoveDisconnectedPlayer(color) {
    if (this.status.state !== "settingRooms" && this.status.state !== "inLobby") {
      return [false, "Игроков можно удалять только до старта матча"];
    }
    const player = this.players[color];
    if (player == null) return [false, "Игрок не найден"];
    if (player.name === this.creator) return [false, "Нельзя удалить создателя лобби"];
    if (player.isSimulated) return [false, "Симуляции удаляются отдельной командой"];
    if (player.connection !== "disconnected") {
      return [false, "Можно удалить только отключившегося игрока"];
    }

    delete this.players[color];
    if (this.status.readyPlayers != null) {
      delete this.status.readyPlayers[color];
    }
    this.recordEvent(
      "player_removed",
      `Отключившийся игрок ${player.name} удалён ведущим`
    );
    this.synchronize();
    return [true];
  }

  adminSetPlayerStatus(color, status) {
    const player = this.players[color];
    if (player == null) return [false, "Игрок не найден"];
    if (player.isHostOnly)
      return [false, "Статус ведущего не относится к матчу"];
    if (!["alive", "dead", "foundDead"].includes(status))
      return [false, "Недопустимый статус игрока"];
    this.#clearPlayerSyncInteractions();
    player.status = status;
    player.currentlyDoing = { activity: "nothing" };
    const statusLabel =
      status === "alive" ? "жив" : status === "dead" ? "убит" : "погиб";
    this.recordEvent(
      "admin_recovery",
      `Статус игрока ${player.name} изменён: ${statusLabel}`
    );
    this.synchronize();
    return [true];
  }

  adminSetPlayerRole(color, roleName) {
    if (!this.testMode.enabled)
      return [false, "Роли можно изменять только в тестовом режиме"];
    const player = this.players[color];
    if (player == null) return [false, "Игрок не найден"];
    if (player.isHostOnly)
      return [false, "Ведущему нельзя назначить игровую роль"];
    if (roleName !== "crew" && roleName !== "impostor")
      return [false, "Недопустимая роль игрока"];

    player.role =
      roleName === "impostor"
        ? { name: "impostor", killCooldown: 0, sabotageCooldown: 0 }
        : { name: "crew" };
    this.recordEvent(
      "test_action",
      `Роль игрока ${player.name} изменена: ${roleName === "crew" ? "оперативник" : "внедрённый агент"}`
    );
    this.synchronize();
    return [true];
  }

  adminAdvancePhase() {
    if (this.pause.active) return [false, "Сначала продолжите игру"];
    if (this.status.state === "roleExplanation") {
      this.#startNewRound();
      return [true];
    }
    if (this.status.state === "meetingCalled") {
      this.startMeeting();
      return [true];
    }
    if (this.status.state === "meeting") {
      this.#stopVote();
      return [true];
    }
    if (this.status.state === "voteResultAnnounced") {
      this.#startNewRound();
      return [true];
    }
    return [false, "Текущую фазу нельзя продвинуть"];
  }

  adminClearFirewall() {
    if (this.activeEffects.firewallBreach == null)
      return [false, "Активного взлома защиты нет"];
    this.#endFirewallBreach();
    this.recordEvent("admin_recovery", "Взлом защиты снят ведущим");
    this.synchronize();
    return [true];
  }

  adminClearSabotage() {
    const effectiveNow = this.pause.active
      ? this.pause.startedAt || Date.now()
      : Date.now();
    const hadActiveSabotage =
      this.activeEffects.firewallBreach != null ||
      this.activeEffects.hacked != null ||
      this._virusScanActiveUntil > effectiveNow;

    if (!hadActiveSabotage) return [false, "Активного саботажа нет"];

    this.activeEffects.firewallBreach = null;
    this.activeEffects.hacked = null;
    this._virusScanActiveUntil = 0;
    this._virusScanTargets.clear();
    for (const player of Object.values(this.players)) {
      if (player.currentlyDoing.activity === "fixFirewall") {
        player.currentlyDoing = { activity: "nothing" };
      }
    }
    this.recordEvent("admin_recovery", "Активный саботаж остановлен ведущим");
    this.synchronize();
    return [true];
  }

  adminSetTestMode(enabled) {
    if (typeof enabled !== "boolean")
      return [false, "Некорректное значение тестового режима"];
    if (
      this.status.state !== "settingRooms" &&
      this.status.state !== "inLobby" &&
      this.status.state !== "gameEnded"
    ) {
      return [false, "Тестовый режим меняется только до или после игры"];
    }

    this.testMode.enabled = enabled;
    if (!enabled) this.#removeTestPlayers();
    this.recordEvent(
      "test_mode",
      `Тестовый режим ${enabled ? "включён" : "выключен"}`
    );
    this.synchronize();
    return [true];
  }

  adminPrepareTestLobby(botCount = 3) {
    if (this.status.state !== "settingRooms")
      return [false, "Тестовую площадку можно создать только на этапе настройки"];

    this.testMode.enabled = true;
    this.activities = Object.fromEntries(
      NFC_ACTIVITIES.map((name, index) => [
        name,
        { id: index + 1, name, room: `Тестовая точка ${index + 1}` },
      ])
    );
    this.status = { state: "inLobby", readyPlayers: {} };
    for (const player of this.participatingPlayers()) {
      this.status.readyPlayers[player.color] = true;
    }
    const added = this.#addTestPlayers(botCount);
    this.recordEvent(
      "test_mode",
      `Тестовая площадка подготовлена, добавлено симуляций: ${added}`
    );
    this.synchronize();
    return [true];
  }

  adminAddTestPlayers(count = 1) {
    if (!this.testMode.enabled)
      return [false, "Сначала включите тестовый режим"];
    if (this.status.state !== "inLobby" && this.status.state !== "settingRooms")
      return [false, "Тестовых игроков можно добавлять только до старта"];

    const added = this.#addTestPlayers(count);
    if (added === 0) return [false, "Нет свободных мест для тестовых игроков"];
    this.recordEvent("test_action", `Добавлено тестовых игроков: ${added}`);
    this.synchronize();
    return [true];
  }

  adminRemoveTestPlayers() {
    if (this.status.state !== "inLobby" && this.status.state !== "settingRooms")
      return [false, "Тестовых игроков можно удалять только до старта"];
    const removed = this.#removeTestPlayers();
    if (removed === 0) return [false, "Тестовых игроков в лобби нет"];
    this.recordEvent("test_action", `Удалено тестовых игроков: ${removed}`);
    this.synchronize();
    return [true];
  }

  adminStartTestGame() {
    if (!this.testMode.enabled)
      return [false, "Сначала включите тестовый режим"];
    if (this.status.state !== "inLobby")
      return [false, "Тестовую игру можно начать только из лобби"];
    if (this.nParticipatingPlayers() < TEST_MODE_MIN_PLAYERS) {
      return [
        false,
        `Для тестового запуска требуется минимум игроков: ${TEST_MODE_MIN_PLAYERS}`,
      ];
    }

    for (const player of this.participatingPlayers()) {
      this.status.readyPlayers[player.color] = true;
    }
    this.startGame();
    return [true];
  }

  adminResetGame() {
    this.#removeGameIntervals();
    this.#clearPlayerSyncInteractions();
    this.activeEffects = { ...ACTIVE_EFFECTS_BASE };
    this._virusScanActiveUntil = 0;
    this._virusScanTargets.clear();
    this.pause = { active: false, startedAt: null };
    this.taskProgression = { real: 0, displayed: 0 };
    this.tasksToWin = 34;
    this.singleTaskProgressionAmount =
      TASK_PROGRESSION_VICTORY_AMOUNT / this.tasksToWin;

    const readyPlayers = {};
    for (const player of Object.values(this.players)) {
      player.status = "alive";
      player.role = { name: "undecided" };
      player.tasks = [];
      player.currentlyDoing = { activity: "nothing" };
      player.taskLockedUntil = 0;
      player.resetSyncTask(false);
      player.emergencyMeetingsLeft = EMERGENCY_MEETINGS_PER_PLAYER;
      readyPlayers[player.color] =
        !player.isHostOnly && player.isSimulated === true;
    }

    this.status = this.activities
      ? { state: "inLobby", readyPlayers }
      : { state: "settingRooms", readyPlayers };
    this.recordEvent("admin_recovery", "Матч сброшен в лобби ведущим");
    this.synchronize();
    return [true];
  }

  adminResetCooldowns() {
    if (!this.testMode.enabled)
      return [false, "Кулдауны можно сбрасывать только в тестовом режиме"];
    for (const impostor of this.#getImpostors()) {
      impostor.role.killCooldown = 0;
      impostor.role.sabotageCooldown = 0;
    }
    this.recordEvent("test_action", "Кулдауны агентов сброшены");
    this.synchronizeCooldowns();
    return [true];
  }

  adminAddTaskProgress() {
    if (!this.testMode.enabled)
      return [false, "Прогресс можно имитировать только в тестовом режиме"];
    if (this.status.state !== "started") return [false, "Раунд не запущен"];
    if (this.pause.active) return [false, "Сначала продолжите игру"];
    this.recordEvent("test_action", "Имитировано выполнение задания");
    this.increaseTaskBar();
    return [true];
  }

  adminCallMeeting() {
    if (!this.testMode.enabled)
      return [false, "Собрание можно имитировать только в тестовом режиме"];
    if (this.status.state !== "started") return [false, "Раунд не запущен"];
    if (this.pause.active) return [false, "Сначала продолжите игру"];
    const participants = this.participatingPlayers();
    const initiator =
      participants.find(
        (player) => player.status === "alive" && !player.isSimulated
      ) || participants.find((player) => player.status === "alive");
    if (initiator == null) return [false, "Нет живого игрока для собрания"];
    this.startMeetingCall("emergency", initiator.color);
    return [true];
  }

  adminLaunchSabotage(kind) {
    if (!this.testMode.enabled)
      return [false, "Саботаж можно имитировать только в тестовом режиме"];
    if (kind !== "virusScan" && kind !== "firewallBreach")
      return [false, "Недопустимый вид саботажа"];
    if (this.pause.active) return [false, "Сначала продолжите игру"];
    const impostor = this.#getImpostors().find(
      (player) => player.status === "alive"
    );
    if (impostor == null) return [false, "В лобби нет живого внедрённого агента"];
    impostor.role.sabotageCooldown = 0;
    return this.launchSabotage(impostor.color, { kind });
  }

  #addTestPlayers(requestedCount) {
    const numericCount = Number.parseInt(String(requestedCount), 10);
    const safeCount = Number.isFinite(numericCount)
      ? Math.max(1, Math.min(5, numericCount))
      : 1;
    const availableSlots = Math.max(
      0,
      Math.min(safeCount, MAX_PLAYERS - Object.keys(this.players).length)
    );
    let added = 0;

    for (let index = 0; index < availableSlots; index += 1) {
      const color = PLAYER_COLORS.find((candidate) => this.players[candidate] == null);
      if (color == null) break;
      let suffix = Object.values(this.players).filter(
        (player) => player.isSimulated
      ).length + 1;
      while (
        Object.values(this.players).some(
          (player) => player.name === `Agent-${String(suffix).padStart(2, "0")}`
        )
      ) {
        suffix += 1;
      }
      const player = new Player({
        name: `Agent-${String(suffix).padStart(2, "0")}`,
        status: "alive",
        connection: "simulated",
        color,
      });
      this.players[color] = player;
      if (this.status.readyPlayers != null) {
        this.status.readyPlayers[color] = true;
      }
      added += 1;
    }

    return added;
  }

  #removeTestPlayers() {
    let removed = 0;
    for (const [color, player] of Object.entries(this.players)) {
      if (!player.isSimulated) continue;
      delete this.players[color];
      if (this.status.readyPlayers != null) delete this.status.readyPlayers[color];
      removed += 1;
    }
    return removed;
  }

  resumeAfterRestore() {
    for (const player of Object.values(this.players)) {
      if (
        player.currentlyDoing?.activity === "awaitingSync" ||
        player.currentlyDoing?.activity === "playerSync"
      ) {
        player.currentlyDoing = { activity: "nothing" };
      }
      if (player.syncTask == null) {
        player.resetSyncTask(!player.isHostOnly);
      }
    }

    if (this.pause.active) {
      this.pause.startedAt = Date.now();
    }

    if (
      ["started", "meetingCalled", "meeting", "voteResultAnnounced"].includes(
        this.status.state
      ) &&
      this.#getImpostors().length > 0
    ) {
      this.#setImpostorCooldowns(false);
    }

    switch (this.status.state) {
      case "roleExplanation":
        this.#startPhaseCountdown("roleExplanation", () => this.#startNewRound());
        break;
      case "started":
        this.#startPhaseCountdown("started");
        break;
      case "meeting":
        this.#startPhaseCountdown("meeting", () => this.#stopVote());
        break;
      case "voteResultAnnounced":
        this.#startPhaseCountdown("voteResultAnnounced", () =>
          this.#startNewRound()
        );
        break;
    }
  }

  #startPhaseCountdown(expectedState, onComplete = null) {
    this.#clearPhaseInterval();

    this._phaseInterval = setInterval(() => {
      if (this._destroyed || this.status.state !== expectedState) {
        this.#clearPhaseInterval();
        return;
      }

      if (typeof this.status.countDown !== "number") {
        this.#clearPhaseInterval();
        return;
      }

      if (this.pause.active) return;

      this.status.countDown = Math.max(0, this.status.countDown - 1);
      this.synchronizeCountDown();

      if (this.status.countDown === 0) {
        this.#clearPhaseInterval();
        if (onComplete != null) onComplete();
      }
    }, 1000);
  }

  #clearPhaseInterval() {
    if (this._phaseInterval == null) return;
    clearInterval(this._phaseInterval);
    this._phaseInterval = null;
  }

#configureTaskScaling() {
  const crewCount = this.participatingPlayers().filter(
    (p) => p.role.name === "crew"
  ).length;

  this.tasksToWin = Math.max(8, Math.round(crewCount * 3.2));
  this.singleTaskProgressionAmount =
    TASK_PROGRESSION_VICTORY_AMOUNT / this.tasksToWin;

  console.debug(
    `Task scaling configured: ${crewCount} crew, ${this.tasksToWin} tasks to win`
  );
}

#assignRolesRandomly() {
  // The host-only creator stays outside the match; everyone else starts as crew.
  for (const player of Object.values(this.players)) {
    player.role = player.isHostOnly ? { name: "undecided" } : { name: "crew" };
  }

  const players = this.participatingPlayers().map((player) => player.color);
  const playerCount = players.length;

  // Dynamic balance for 6-15 players:
  // 2-7 players  -> 1 impostor
  // 8-12 players -> 2 impostors
  // 13-15 players -> 3 impostors
  //
  // We keep 1 impostor for low-player tests so local testing with 2-5 tabs still works.
  const impostorCount =
    playerCount >= 13 ? 3 :
    playerCount >= 8 ? 2 :
    1;

  // Prefer players who were not impostors in the previous match. This keeps
  // the assignment random while avoiding frustrating role streaks whenever
  // the lobby has enough alternative candidates.
  const freshCandidates = players.filter(
    (color) => !this._lastImpostorColors.has(color)
  );
  const repeatedCandidates = players.filter((color) =>
    this._lastImpostorColors.has(color)
  );

  const impostorColors = new Set();
  while (impostorColors.size < impostorCount) {
    const candidates =
      freshCandidates.length > 0 ? freshCandidates : repeatedCandidates;
    const candidateIndex = randInt(0, candidates.length - 1);
    const [selectedColor] = candidates.splice(candidateIndex, 1);
    impostorColors.add(selectedColor);
  }
  this._lastImpostorColors = new Set(impostorColors);

  // Set the selected players to impostor
  for (const impostorColor of impostorColors.values()) {
    this.players[impostorColor].role = {
      name: "impostor",
      killCooldown: this.testMode.enabled
        ? TEST_MODE_TIMERS.killCooldown
        : KILL_COOLDOWN_SECS,
      sabotageCooldown: this.testMode.enabled
        ? TEST_MODE_TIMERS.sabotageCooldown
        : SABO_COOLDOWN_SECS,
    };
  }

  console.debug(
    `Player roles decided: ${playerCount} players, ${impostorCount} impostor(s)`
  );
}

  #getImpostors() {
    return Object.values(this.players).filter(
      (p) => p.role.name === "impostor"
    );
  }

  // Starts the timer that handles impostor kill & sabotage cooldown, and the firewall breached timer
  #setImpostorCooldowns(resetCooldowns = true) {
    const impostors = this.#getImpostors();
    if (resetCooldowns) {
      for (const player of impostors) {
        player.role.killCooldown = this.testMode.enabled
          ? TEST_MODE_TIMERS.killCooldown
          : KILL_COOLDOWN_SECS;
        player.role.sabotageCooldown = this.testMode.enabled
          ? TEST_MODE_TIMERS.sabotageCooldown
          : SABO_COOLDOWN_SECS;
      }
    }

    if (this._impostorCdInterval != null)
      clearInterval(this._impostorCdInterval);

    this._impostorCdInterval = setInterval(() => {
      // Only sync if a timer actually changed
      let sync = false;

      // Sabotage cooldown / Firewall breach do not tick down when game is paused,
      // e.g. because of a meeting
      const gamePaused = this.status.state !== "started" || this.pause.active;

      for (const player of impostors) {
        if (player.role.killCooldown > 0 && !gamePaused) {
          player.role.killCooldown -= 1;
          sync = true;
        }

        if (player.role.sabotageCooldown > 0 && !gamePaused) {
          player.role.sabotageCooldown -= 1;
          sync = true;
        }
      }
      if (
        this.activeEffects.firewallBreach != null &&
        !gamePaused &&
        this.activeEffects.firewallBreach.countDown > 0
      ) {
        const { buttonsPressed } = this.activeEffects.firewallBreach;
        if (buttonsPressed.firewallbutton1 && buttonsPressed.firewallbutton2) {
          this.#endFirewallBreach();
        } else {
          this.activeEffects.firewallBreach.countDown -= 1;
          if (this.activeEffects.firewallBreach.countDown === 0) {
            this.#endGame("impostor", "Защита не была восстановлена вовремя");
            return;
          }
          sync = true;
        }
      }
      if (sync) this.synchronizeCooldowns();
    }, 1000);
  }

  #removeGameIntervals() {
    this.#clearPhaseInterval();
    if (this._impostorCdInterval != null) {
      clearInterval(this._impostorCdInterval);
      this._impostorCdInterval = null;
    }
  }

  #removeIntervals() {
    this.#removeGameIntervals();
    if (this._lobbyDeleteTimeout != null)
      clearTimeout(this._lobbyDeleteTimeout);
    this._lobbyDeleteTimeout = null;
  }

  // Return lobby without any private properties (starting with _)
  serialize() {
    const lobbyState = { ...this };
    Object.keys(lobbyState).forEach((key) =>
      key.startsWith("_") ? delete lobbyState[key] : ""
    );
    return lobbyState;
  }

  serializeForPlayer(viewerColor) {
    const lobbyState = this.serialize();
    const viewer = this.players[viewerColor];
    lobbyState.players = Object.fromEntries(
      Object.entries(lobbyState.players).map(([color, player]) => {
        const canSeeRole =
          this.status.state === "gameEnded" ||
          color === viewerColor ||
          (viewer?.role.name === "impostor" && player.role.name === "impostor");
        return [color, canSeeRole ? player : { ...player, role: { name: "undecided" } }];
      })
    );
    lobbyState.playerSync = this.#playerSyncView(viewerColor);
    return lobbyState;
  }

  serializeAdmin() {
    const effectiveNow = this.pause.active
      ? this.pause.startedAt || Date.now()
      : Date.now();
    return {
      ...this.serialize(),
      eventLog: [...this._eventLog],
      preflightChecks: structuredClone(this._preflightChecks),
      adminState: {
        virusScanActive: this._virusScanActiveUntil > effectiveNow,
        virusScanSecondsLeft: Math.max(
          0,
          Math.ceil((this._virusScanActiveUntil - effectiveNow) / 1000)
        ),
        virusScanTargets: [...this._virusScanTargets],
      },
    };
  }

  serializePersistence() {
    const effectiveNow = this.pause.active
      ? this.pause.startedAt || Date.now()
      : Date.now();
    return {
      ...this.serialize(),
      players: Object.fromEntries(
        Object.entries(this.players).map(([color, player]) => [
          color,
          { ...player, socketId: null },
        ])
      ),
      eventLog: [...this._eventLog],
      preflightChecks: structuredClone(this._preflightChecks),
      lastImpostorColors: [...this._lastImpostorColors],
      virusScanRemainingMs: Math.max(
        0,
        this._virusScanActiveUntil - effectiveNow
      ),
      virusScanTargets: [...this._virusScanTargets],
    };
  }

  // Cancel all intervals and make sure synchronize events do not reach a client. To be used before lobby is deleted.
  destroy() {
    this._destroyed = true;
    this.#clearPlayerSyncInteractions();
    this.#removeIntervals();
  }
}

// Create lobby, return {lobby: lobby object, player: player object }
export function createLobby(creatorName, { hostParticipates = true } = {}) {
  const player = new Player({
    name: creatorName,
    status: "alive",
    connection: "connected",
    isHostOnly: hostParticipates === false,
  });
  const lobbyId = nanoid();
  const lobby = new Lobby({
    id: lobbyId,
    players: { [player.color]: player },
    creator: creatorName,
    status: { state: "settingRooms", readyPlayers: {} },
  });
  lobby.recordEvent(
    "lobby_created",
    `Лобби создано: ${creatorName} (${player.isHostOnly ? "ведущий только управляет" : "ведущий участвует"})`
  );
  lobbies[lobbyId] = lobby;
  scheduleLobbiesPersistence();
  return { lobby, player };
}

// Join an existing lobby, return [false, `error string`] or [true, {lobby: lobby object, player: player object}]
export function joinLobby(lobbyId, playerName) {
  const lobby = lobbies[lobbyId];
  if (lobby == null) return [false, `Лобби ${lobbyId} не существует`];

  const players = lobby.players;

  if (lobby.status.state !== "settingRooms" && lobby.status.state !== "inLobby") {
    return [false, "Игра уже началась и не принимает новых игроков"];
  }

  const existingPlayerWithName = Object.values(players).find(
    ({ name }) => playerName.localeCompare(name, "ru", { sensitivity: "accent" }) === 0
  );

  if (existingPlayerWithName != null) {
    return [
      false,
      "Этот ник уже используется. Продолжите сохранённую сессию или выберите другой ник.",
    ];
  }

  if (Object.values(players).length === MAX_PLAYERS)
    return [false, `Достигнуто максимальное количество игроков`];

  if (lobby._lobbyDeleteTimeout != null) {
    clearTimeout(lobby._lobbyDeleteTimeout);
    lobby._lobbyDeleteTimeout = null;
    console.debug(
      `Lobby ${lobby.id} no longer scheduled for deletion because player joined`
    );
  }

  // Give player a random, non-used color
  let color = randomPlayerColor();

  // Loop until we find a color that is not in use yet
  while (players[color] != null) {
    color = randomPlayerColor();
  }

  const player = new Player({
    name: playerName,
    status: "alive",
    connection: "connected",
    color,
  });

  lobby.players[color] = player;
  lobby.recordEvent("player_joined", `${playerName} подключился к лобби`);
  scheduleLobbiesPersistence();

  return [true, { lobby, player }];
}

export function getLobby(lobbyId) {
  return lobbies[lobbyId];
}

export function getAdminSnapshot() {
  return Object.values(lobbies).map((lobby) => lobby.serializeAdmin());
}

export function getHostAdminRoom(lobbyId) {
  return `protocol-150-host-${lobbyId}`;
}

function broadcastAdminSnapshot() {
  io.to("protocol-150-admins").emit("adminSnapshot", {
    lobbies: getAdminSnapshot(),
  });
  for (const lobby of Object.values(lobbies)) {
    io.to(getHostAdminRoom(lobby.id)).emit("adminSnapshot", {
      lobbies: [lobby.serializeAdmin()],
    });
  }
}

function persistedLobbiesSnapshot() {
  return Object.values(lobbies).map((lobby) => lobby.serializePersistence());
}

function scheduleLobbiesPersistence() {
  scheduleLobbyStateWrite(persistedLobbiesSnapshot());
}

export function flushLobbiesToDisk() {
  flushLobbyStateWrite(persistedLobbiesSnapshot());
}

function restorePersistedLobbies() {
  const storedLobbies = readPersistedLobbyState();

  for (const stored of storedLobbies) {
    try {
      if (
        typeof stored?.id !== "string" ||
        typeof stored?.creator !== "string" ||
        stored?.players == null ||
        stored?.status?.state == null
      ) {
        throw new Error("lobby snapshot is incomplete");
      }

      const players = Object.fromEntries(
        Object.entries(stored.players).map(([color, savedPlayer]) => {
          const restoredName = savedPlayer.isSimulated
            ? String(savedPlayer.name).replace(/^Тест-агент (\d+)$/, (_, number) =>
                `Agent-${String(number).padStart(2, "0")}`
              )
            : savedPlayer.name;
          const player = new Player({
            name: restoredName,
            status: savedPlayer.status,
            color,
            connection: savedPlayer.isSimulated ? "simulated" : "disconnected",
            isHostOnly: savedPlayer.isHostOnly === true,
          });
          Object.assign(player, savedPlayer, {
            name: restoredName,
            color,
            socketId: null,
            connection: savedPlayer.isSimulated ? "simulated" : "disconnected",
          });
          return [color, player];
        })
      );

      const lobby = new Lobby({
        id: stored.id,
        players,
        creator: stored.creator,
        status: stored.status,
        pause: stored.pause,
        lastImpostorColors: stored.lastImpostorColors,
      });
      lobby.taskProgression = stored.taskProgression ?? lobby.taskProgression;
      lobby.tasksToWin = stored.tasksToWin ?? lobby.tasksToWin;
      lobby.singleTaskProgressionAmount =
        stored.singleTaskProgressionAmount ?? lobby.singleTaskProgressionAmount;
      lobby.activities = stored.activities ?? null;
      lobby.activeEffects = stored.activeEffects ?? { ...ACTIVE_EFFECTS_BASE };
      lobby.testMode = stored.testMode ?? { enabled: false };
      lobby._eventLog = Array.isArray(stored.eventLog)
        ? stored.eventLog.slice(-100)
        : [];
      lobby._virusScanTargets = new Set(stored.virusScanTargets ?? []);
      lobby._preflightChecks =
        stored.preflightChecks != null && typeof stored.preflightChecks === "object"
          ? stored.preflightChecks
          : {};
      lobby._virusScanActiveUntil =
        Date.now() + Math.max(0, Number(stored.virusScanRemainingMs) || 0);

      lobbies[lobby.id] = lobby;
      lobby.recordEvent(
        "server_recovery",
        "Лобби восстановлено после перезапуска сервера"
      );
      lobby.resumeAfterRestore();
      lobby.scheduleDeletionIfAbandoned();
      console.log(`Restored lobby ${lobby.id}`);
    } catch (error) {
      console.error("Could not restore lobby snapshot:", error);
    }
  }

  if (storedLobbies.length > 0) scheduleLobbiesPersistence();
}

restorePersistedLobbies();
