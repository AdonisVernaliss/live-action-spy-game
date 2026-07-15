<script lang="ts">
  import { onMount } from "svelte";
  import { getSocketIO } from "$lib/websocket";
  import { gotoReplace } from "$lib/util";
  import { lobbyStore, playerColorStore } from "$lib/stores";
  import type { Color } from "$lib/types";
  import type { Socket } from "socket.io-client";
  import { language, localizeGameReason, localizeServerMessage } from "$lib/i18n";
  import { clearTestMinigame, startTestMinigame } from "$lib/testMinigame";
  import VenuePreflight from "$lib/VenuePreflight.svelte";

  type AuthMode = "host" | "global" | null;
  type StoredGameInfo = {
    playerId: string;
    lobbyId: string;
    color: Color;
  };

  let socket: Socket;
  let secret = "";
  let authenticated = false;
  let authenticating = false;
  let authMode: AuthMode = null;
  let error = "";
  let notice = "";
  let lobbies: any[] = [];
  let selectedLobbyId = "";
  let hostSession: StoredGameInfo | null = null;
  let runningAction = "";
  let dashboardTab: "control" | "preflight" = "control";
  const bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  const testMinigames = [
    { id: 0, ru: "Последовательность", en: "Sequence" },
    { id: 1, ru: "Перехват сигнала", en: "Signal interception" },
    { id: 2, ru: "Взлом пароля", en: "Password crack" },
    { id: 3, ru: "Хеш-реактор", en: "Hash reactor" },
    { id: 4, ru: "Уничтожение вирусов", en: "Virus cleanup" },
    { id: 5, ru: "Сумма до ста", en: "Sum to one hundred" },
    { id: 6, ru: "Уничтожение улик", en: "Evidence disposal" },
    { id: 7, ru: "Маршрутизация пакетов", en: "Packet routing" },
    { id: 8, ru: "Журнал доступа", en: "Access log" },
    { id: 9, ru: "Энергосеть", en: "Power grid" },
  ];

  $: selectedLobby =
    lobbies.find((lobby) => lobby.id === selectedLobbyId) ||
    lobbies[0] ||
    null;
  $: selectedPlayers = selectedLobby ? playersOf(selectedLobby) : [];
  $: participatingPlayers = selectedPlayers.filter(
    (player) => !player.isHostOnly
  );
  $: aliveCount = participatingPlayers.filter(
    (player) => player.status === "alive"
  ).length;
  $: simulatedCount = participatingPlayers.filter(
    (player) => player.isSimulated
  ).length;
  $: hostSessionPlayer =
    authMode === "host" && selectedLobby && hostSession
      ? selectedLobby.players?.[hostSession.color]
      : null;
  $: showReturnButton =
    authMode === "global" ||
    !hostSessionPlayer?.isHostOnly ||
    ["settingRooms", "inLobby"].includes(selectedLobby?.status?.state);
  $: returnButtonLabel =
    authMode === "global"
      ? bi("На главную", "Home")
      : hostSessionPlayer?.isHostOnly
        ? selectedLobby?.status?.state === "settingRooms"
          ? bi("К площадке", "Venue setup")
          : bi("В лобби", "Lobby")
        : bi("В игру", "Game");
  $: hasActiveSabotage =
    selectedLobby?.activeEffects?.firewallBreach != null ||
    selectedLobby?.activeEffects?.hacked != null ||
    selectedLobby?.adminState?.virusScanActive === true;
  $: canAdvancePhase = [
    "roleExplanation",
    "meetingCalled",
    "meeting",
    "voteResultAnnounced",
  ].includes(selectedLobby?.status?.state);
  $: canPauseMatch =
    selectedLobby != null &&
    !["settingRooms", "inLobby", "gameEnded"].includes(
      selectedLobby.status.state
    );

  onMount(() => {
    const scrollRootClass = "admin-scroll-root";
    document.documentElement.classList.add(scrollRootClass);
    document.body.classList.add(scrollRootClass);
    clearTestMinigame();
    socket = getSocketIO();
    secret = sessionStorage.getItem("protocol150AdminSecret") || "";
    hostSession = readHostSession();

    socket.on(
      "adminSnapshot",
      ({ lobbies: nextLobbies }: { lobbies: any[] }) => {
        if (authenticated) setLobbies(nextLobbies);
      }
    );

    const onConnect = () => {
      if (authMode === "host") authenticateHost(true);
      else if (authMode === "global" && secret) authenticateGlobal();
      else beginAuthentication();
    };
    socket.on("connect", onConnect);

    beginAuthentication();

    const refreshTimer = window.setInterval(() => {
      if (!authenticated || !socket.connected) return;
      socket.emit("adminRefresh", ({ success, lobbies: refreshed }: any) => {
        if (success && refreshed) setLobbies(refreshed);
      });
    }, 2000);

    return () => {
      document.documentElement.classList.remove(scrollRootClass);
      document.body.classList.remove(scrollRootClass);
      window.clearInterval(refreshTimer);
      socket.off("adminSnapshot");
      socket.off("connect", onConnect);
    };
  });

  function readHostSession(): StoredGameInfo | null {
    try {
      const raw = localStorage.getItem("gameInfo");
      if (!raw) return null;
      const info = JSON.parse(raw);
      if (
        typeof info?.playerId !== "string" ||
        typeof info?.lobbyId !== "string" ||
        typeof info?.color !== "string"
      ) {
        return null;
      }
      return info as StoredGameInfo;
    } catch {
      return null;
    }
  }

  function beginAuthentication() {
    if (authenticated || authenticating) return;
    if (hostSession) authenticateHost(true);
    else if (secret) authenticateGlobal();
  }

  function authenticateHost(silent = false) {
    if (!hostSession || authenticating) return;
    authenticating = true;
    if (!silent) error = "";
    socket.emit(
      "hostAuthenticate",
      { gameInfo: hostSession },
      ({ success, message, lobbies: initial }: any) => {
        authenticating = false;
        if (!success) {
          authMode = null;
          if (silent) hostSession = null;
          if (!silent)
            error = message || "Не удалось открыть панель лобби.";
          if (secret) authenticateGlobal();
          return;
        }
        authenticated = true;
        authMode = "host";
        error = "";
        setLobbies(initial || []);
      }
    );
  }

  function authenticateGlobal() {
    if (!secret || authenticating) return;
    authenticating = true;
    error = "";
    socket.emit(
      "adminAuthenticate",
      { secret },
      ({ success, message, lobbies: initial }: any) => {
        authenticating = false;
        if (!success) {
          authenticated = false;
          authMode = null;
          error = message || "Не удалось войти.";
          sessionStorage.removeItem("protocol150AdminSecret");
          return;
        }
        authenticated = true;
        authMode = "global";
        setLobbies(initial || []);
        sessionStorage.setItem("protocol150AdminSecret", secret);
      }
    );
  }

  function logout() {
    socket.emit("adminLogout");
    authenticated = false;
    authMode = null;
    lobbies = [];
    selectedLobbyId = "";
    secret = "";
    sessionStorage.removeItem("protocol150AdminSecret");
  }

  function returnToGame() {
    if (authMode !== "host" || !hostSession) {
      gotoReplace("/");
      return;
    }

    error = "";
    socket.once(
      "reconnected",
      ({ success, lobby, color }: any) => {
        if (!success) {
          error = "Игровая сессия больше недоступна.";
          return;
        }

        playerColorStore.set(color);
        lobbyStore.set(lobby);
        const player = lobby.players?.[color];
        const playerStatus = player?.status;

        if (player?.isHostOnly) {
          if (lobby.status.state === "settingRooms") gotoReplace("/setuprooms");
          else if (lobby.status.state === "inLobby") gotoReplace("/lobby");
          else gotoReplace("/admin");
          return;
        }

        const routes: Record<string, string> = {
          settingRooms: "/setuprooms",
          inLobby: "/lobby",
          roleExplanation: "/role",
          meetingCalled: "/meetingcall",
          meeting: "/vote",
          voteResultAnnounced: "/voteover",
          gameEnded: "/gameover",
        };

        if (lobby.status.state === "started") {
          gotoReplace(
            playerStatus === "alive"
              ? "/game"
              : playerStatus === "dead"
                ? "/killed"
                : "/dead"
          );
        } else {
          gotoReplace(routes[lobby.status.state] || "/");
        }
      }
    );

    socket.emit("reconnect", {
      color: hostSession.color,
      playerId: hostSession.playerId,
      lobbyId: hostSession.lobbyId,
    });
  }

  function runAction(
    action: string,
    info: Record<string, unknown> = {},
    confirmation = ""
  ) {
    if (!selectedLobby || runningAction) return;
    if (confirmation && !window.confirm(confirmation)) return;

    runningAction = action;
    error = "";
    notice = "";
    socket.emit(
      "adminAction",
      { lobbyId: selectedLobby.id, action, ...info },
      ({ success, message, lobbies: updated }: any) => {
        runningAction = "";
        if (!success) {
          error = message || "Не удалось выполнить действие ведущего.";
          return;
        }
        notice = "Команда выполнена";
        if (updated) setLobbies(updated);
        window.setTimeout(() => (notice = ""), 1800);
      }
    );
  }

  function applyVenueFromPreflight(
    event: CustomEvent<{ activities: Record<string, unknown> }>
  ) {
    runAction("applyVenue", { activities: event.detail.activities });
  }

  function markPreflightCheck(
    event: CustomEvent<{ tag: string; method: "qr" | "nfc" }>
  ) {
    runAction("markPreflightCheck", event.detail);
  }

  function statusLabel(status: any) {
    const labels: Record<string, [string, string]> = {
      settingRooms: ["Настройка площадки", "Venue setup"],
      inLobby: ["Зал ожидания", "Waiting room"],
      roleExplanation: ["Показ ролей", "Role reveal"],
      started: ["Активный раунд", "Active round"],
      meetingCalled: ["Сбор на собрание", "Meeting assembly"],
      meeting: ["Голосование", "Voting"],
      voteResultAnnounced: ["Результат голосования", "Voting result"],
      gameEnded: ["Игра окончена", "Game over"],
    };
    return labels[status?.state] ? bi(...labels[status.state]) : status?.state || "—";
  }

  function statusDetails(lobby: any) {
    if (lobby.pause?.active)
      return bi("Матч остановлен, все таймеры заморожены", "Match paused; all timers are frozen");
    if (lobby.status.state === "gameEnded") {
      const winner =
        lobby.status.victors === "crew"
          ? bi("оперативники", "operatives")
          : bi("внедрённые агенты", "infiltrated agents");
      return `${winner}: ${localizeGameReason(lobby.status.reason)}`;
    }
    if (lobby.status.state === "meetingCalled") {
      return bi(
        `На месте: ${Object.keys(lobby.status.presentPlayers || {}).length}/${aliveCount}`,
        `Present: ${Object.keys(lobby.status.presentPlayers || {}).length}/${aliveCount}`
      );
    }
    if (typeof lobby.status.countDown === "number") {
      return bi(`Осталось ${lobby.status.countDown} сек.`, `${lobby.status.countDown}s remaining.`);
    }
    return lobby.testMode?.enabled
      ? bi("Тестовый режим", "Test mode")
      : bi("Обычный режим", "Standard mode");
  }

  function roleLabel(role: string) {
    if (role === "crew") return bi("оперативник", "operative");
    if (role === "impostor") return bi("внедрённый агент", "infiltrated agent");
    return bi("не назначена", "not assigned");
  }

  function playerStatusLabel(status: string) {
    if (status === "alive") return bi("жив", "alive");
    if (status === "dead") return bi("тело не найдено", "body not found");
    return bi("погиб", "dead");
  }

  function activityLabel(player: any) {
    const activity = player.currentlyDoing;
    if (!activity || activity.activity === "nothing") return bi("свободен", "idle");
    if (activity.activity === "task")
      return bi(`задание ${activity.number + 1}`, `task ${activity.number + 1}`);
    if (activity.activity === "fixFirewall")
      return bi(
        `терминал защиты ${activity.number + 1}`,
        `firewall terminal ${activity.number + 1}`
      );
    return activity.activity;
  }

  function taskSummary(player: any) {
    const tasks = player.tasks || [];
    const completed = tasks.filter((task: any) => task.status === "completed").length;
    return `${completed}/${tasks.length}`;
  }

  function colorValue(color: string) {
    const colors: Record<string, string> = {
      green: "#22c55e",
      blue: "#3b82f6",
      yellow: "#facc15",
      pink: "#f472b6",
      red: "#ef4444",
      orange: "#f97316",
      purple: "#a855f7",
      black: "#4b5563",
      white: "#f8fafc",
      cyan: "#22d3ee",
      lime: "#84cc16",
      brown: "#92400e",
      gray: "#9ca3af",
      navy: "#1e3a8a",
      maroon: "#881337",
    };
    return colors[color] || "#94a3b8";
  }

  function colorLabel(color: string) {
    const labels: Record<string, [string, string]> = {
      green: ["зелёный", "green"],
      blue: ["синий", "blue"],
      yellow: ["жёлтый", "yellow"],
      pink: ["розовый", "pink"],
      red: ["красный", "red"],
      orange: ["оранжевый", "orange"],
      purple: ["фиолетовый", "purple"],
      black: ["чёрный", "black"],
      white: ["белый", "white"],
      cyan: ["голубой", "cyan"],
      lime: ["салатовый", "lime"],
      brown: ["коричневый", "brown"],
      gray: ["серый", "gray"],
      navy: ["тёмно-синий", "navy"],
      maroon: ["бордовый", "maroon"],
    };
    return labels[color] ? bi(...labels[color]) : color;
  }

  function eventTypeLabel(type: string) {
    const labels: Record<string, [string, string]> = {
      lobby_created: ["создание лобби", "lobby created"],
      player_joined: ["подключение", "player joined"],
      game_started: ["начало игры", "game started"],
      player_killed: ["устранение", "elimination"],
      meeting_called: ["собрание", "meeting"],
      vote_cast: ["голосование", "vote"],
      sabotage: ["саботаж", "sabotage"],
      virus_penalty: ["вирусная проверка", "virus scan"],
      game_ended: ["конец игры", "game ended"],
      admin_recovery: ["команда ведущего", "host action"],
      test_mode: ["тестовый режим", "test mode"],
      test_action: ["тестовая команда", "test action"],
      game_paused: ["пауза", "paused"],
      game_resumed: ["продолжение", "resumed"],
      player_removed: ["удаление игрока", "player removed"],
      server_recovery: ["восстановление сервера", "server recovery"],
      player_sync_requested: ["запрос синхронизации", "sync requested"],
      player_sync_started: ["синхронизация", "synchronization"],
      player_sync_completed: ["завершение синхронизации", "sync completed"],
      player_sync_expired: ["запрос истёк", "sync expired"],
      player_sync_cancelled: ["отмена синхронизации", "sync cancelled"],
      venue_configured: ["площадка", "venue"],
      preflight_check: ["проверка площадки", "venue check"],
    };
    return labels[type] ? bi(...labels[type]) : bi("событие", "event");
  }

  function eventMessage(event: any) {
    const message = String(event.message || "");
    if ($language === "ru") return message;

    const exact: Record<string, string> = {
      "Игра началась, роли назначены": "Game started; roles assigned",
      "Матч поставлен на паузу ведущим": "Match paused by the host",
      "Матч продолжен ведущим": "Match resumed by the host",
      "Взлом защиты снят ведущим": "Firewall breach cleared by the host",
      "Активный саботаж остановлен ведущим": "Active sabotage stopped by the host",
      "Матч сброшен в лобби ведущим": "Match reset to the lobby by the host",
      "Кулдауны агентов сброшены": "Agent cooldowns reset",
      "Имитировано выполнение задания": "Task completion simulated",
      "Лобби восстановлено после перезапуска сервера":
        "Lobby restored after server restart",
      "Запрос синхронизации отменён": "Synchronization request cancelled",
      "Проверки площадки сброшены ведущим": "Venue checks reset by the host",
    };
    if (exact[message]) return exact[message];

    return message
      .replace(/^Лобби создано: (.+) \(ведущий только управляет\)$/, "Lobby created: $1 (host only)")
      .replace(/^Лобби создано: (.+) \(ведущий участвует\)$/, "Lobby created: $1 (host participates)")
      .replace(/^(.+) подключился к лобби$/, "$1 joined the lobby")
      .replace(
        /^Запрос синхронизации (.+) и (.+) истёк$/,
        "Synchronization request between $1 and $2 expired"
      )
      .replace(/^(.+) запросил синхронизацию с (.+)$/, "$1 requested synchronization with $2")
      .replace(/^(.+) и (.+) завершили синхронизацию$/, "$1 and $2 completed synchronization")
      .replace(/^(.+) и (.+) начали синхронизацию$/, "$1 and $2 started synchronization")
      .replace(/^(.+) устранён игроком (.+)$/, "$1 was eliminated by $2")
      .replace(/^(.+) отправил голос$/, "$1 submitted a vote")
      .replace(/^(.+) двигался во время вирусной проверки$/, "$1 moved during the virus scan")
      .replace(/^Вирусная проверка запущена игроком (.+)$/, "Virus scan launched by $1")
      .replace(/^Взлом защиты запущен игроком (.+)$/, "Firewall breach launched by $1")
      .replace(/^Отключившийся игрок (.+) удалён ведущим$/, "Disconnected player $1 was removed by the host")
      .replace(/^Статус игрока (.+) изменён: жив$/, "$1 status changed: alive")
      .replace(/^Статус игрока (.+) изменён: убит$/, "$1 status changed: dead, body not found")
      .replace(/^Статус игрока (.+) изменён: погиб$/, "$1 status changed: dead")
      .replace(/^Роль игрока (.+) изменена: оперативник$/, "$1 role changed: operative")
      .replace(/^Роль игрока (.+) изменена: внедрённый агент$/, "$1 role changed: infiltrated agent")
      .replace(/^Тестовый режим включён$/, "Test mode enabled")
      .replace(/^Тестовый режим выключен$/, "Test mode disabled")
      .replace(/^Тестовая площадка подготовлена, добавлено симуляций: (\d+)$/, "Test venue prepared; simulations added: $1")
      .replace(/^Добавлено тестовых игроков: (\d+)$/, "Simulated players added: $1")
      .replace(/^Удалено тестовых игроков: (\d+)$/, "Simulated players removed: $1")
      .replace(/^Площадка настроена: (\d+) точек$/, "Venue configured: $1 points")
      .replace(/^QR проверен: (.+)$/, "QR verified: $1")
      .replace(/^NFC проверен: (.+)$/, "NFC verified: $1")
      .replace(/^Экстренное собрание созвано игроком (.+)$/, "Emergency meeting called by $1")
      .replace(/^Собрание по найденному телу созвано игроком (.+)$/, "Body meeting called by $1")
      .replace(/^Победили оперативники\. (.+)$/, (_, reason) => `Operatives won. ${localizeGameReason(reason)}`)
      .replace(/^Победили внедрённые агенты\. (.+)$/, (_, reason) => `Infiltrated agents won. ${localizeGameReason(reason)}`);
  }

  function setLobbies(nextLobbies: any[]) {
    lobbies = nextLobbies;
    if (!lobbies.some((lobby) => lobby.id === selectedLobbyId)) {
      selectedLobbyId = lobbies[0]?.id || "";
    }
  }

  function playersOf(lobby: any): any[] {
    return Object.values(lobby.players || {}) as any[];
  }
</script>

<main class="admin-dashboard">
  {#if !authenticated}
    <section class="login-card">
      <p class="eyebrow">{bi("Протокол 150", "Protocol 150")}</p>
      <h1>{bi("Панель ведущего", "Host panel")}</h1>
      <p class="lead">
        {bi(
          "Создатель управляет своим лобби автоматически. Глобальный секрет нужен только для технического доступа ко всем активным играм.",
          "The creator manages their lobby automatically. The global secret is only needed for technical access to every active game."
        )}
      </p>

      {#if hostSession}
        <button
          class="primary-button"
          on:click={() => authenticateHost(false)}
          disabled={authenticating}
        >
          {bi("Открыть текущее лобби как ведущий", "Open current lobby as host")}
        </button>
        <div class="divider"><span>{bi("или", "or")}</span></div>
      {/if}

      <label class="secret-field">
        <span>{bi("Глобальный ADMIN_SECRET", "Global ADMIN_SECRET")}</span>
        <input
          type="password"
          bind:value={secret}
          on:keydown={(event) =>
            event.key === "Enter" && authenticateGlobal()}
          placeholder={bi("Секрет технического администратора", "Technical administrator secret")}
        />
      </label>
      {#if error}<p class="error">{localizeServerMessage(error, $language)}</p>{/if}
      <button on:click={authenticateGlobal} disabled={authenticating || !secret}>
        {authenticating ? bi("Проверка…", "Checking…") : bi("Войти по секрету", "Sign in with secret")}
      </button>
      <button class="ghost-button" on:click={() => gotoReplace("/")}>
        {bi("Вернуться в игру", "Return to game")}
      </button>
    </section>
  {:else}
    <header class="topbar">
      <div>
        <p class="eyebrow">{bi("Протокол 150", "Protocol 150")}</p>
        <h1>{bi("Пульт ведущего", "Host controls")}</h1>
      </div>
      <div class="topbar-actions">
        <span
          class:test-badge={selectedLobby?.testMode?.enabled || selectedLobby?.pause?.active}
          class="mode-badge"
        >
          {selectedLobby?.pause?.active
            ? bi("ПАУЗА", "PAUSED")
            : selectedLobby?.testMode?.enabled
            ? bi("ТЕСТ", "TEST")
            : authMode === "global"
              ? bi("ОПЕРАТОР", "OPERATOR")
              : bi("ВЕДУЩИЙ", "HOST")}
        </span>
        {#if showReturnButton}
          <button class="ghost-button" on:click={returnToGame}>
            {returnButtonLabel}
          </button>
        {/if}
        <button class="ghost-button" on:click={logout}>{bi("Выйти", "Sign out")}</button>
      </div>
    </header>

    {#if error}<div class="error-banner">{localizeServerMessage(error, $language)}</div>{/if}
    {#if notice}<div class="notice-banner">{localizeServerMessage(notice, $language)}</div>{/if}

    <nav class="dashboard-tabs" aria-label={bi("Разделы панели", "Panel sections")}>
      <div class="tab-buttons">
        <button type="button" class:active={dashboardTab === "control"} aria-pressed={dashboardTab === "control"} on:click={() => (dashboardTab = "control")}>
          {bi("Управление матчем", "Match control")}
        </button>
        <button type="button" class:active={dashboardTab === "preflight"} aria-pressed={dashboardTab === "preflight"} on:click={() => (dashboardTab = "preflight")}>
          {bi("Подготовка площадки", "Venue preflight")}
        </button>
      </div>
      {#if authMode === "global" && lobbies.length > 1}
        <label class="tab-lobby-picker">
          <span>{bi("Лобби", "Lobby")}</span>
          <select bind:value={selectedLobbyId}>
            {#each lobbies as lobby}
              <option value={lobby.id}>{lobby.creator} · {lobby.id.slice(0, 8)}</option>
            {/each}
          </select>
        </label>
      {/if}
    </nav>

    {#if dashboardTab === "preflight"}
      {#if selectedLobby}
        <div class="preflight-content">
          <VenuePreflight
            lobby={selectedLobby}
            players={selectedPlayers}
            on:applyVenue={applyVenueFromPreflight}
            on:mark={markPreflightCheck}
            on:clear={() =>
              runAction(
                "clearPreflightChecks",
                {},
                bi("Сбросить все отметки QR и NFC?", "Reset every QR and NFC check?")
              )}
          />
        </div>
      {:else}
        <section class="empty-state preflight-content">
          <h2>{bi("Активных лобби нет", "No active lobbies")}</h2>
          <p>{bi("Создайте игру, чтобы начать проверку площадки.", "Create a game to start venue preflight.")}</p>
        </section>
      {/if}
    {:else}
      <div class="dashboard-grid">
      {#if authMode === "global"}
        <aside class="lobby-list">
          <h2>{bi("Активные лобби", "Active lobbies")}</h2>
          {#if lobbies.length === 0}
            <p class="muted">{bi("Активных лобби нет.", "No active lobbies.")}</p>
          {/if}
          {#each lobbies as lobby}
            <button
              class:active={selectedLobby?.id === lobby.id}
              on:click={() => (selectedLobbyId = lobby.id)}
            >
              <strong>{lobby.creator}</strong>
              <small>{lobby.id.slice(0, 8)} · {statusLabel(lobby.status)}</small>
            </button>
          {/each}
        </aside>
      {/if}

      {#if selectedLobby}
        <section class="content">
          <section class="mission-header">
            <div>
              <p class="eyebrow">{bi("Лобби", "Lobby")} {selectedLobby.id.slice(0, 8)}</p>
              <h2>{selectedLobby.creator}</h2>
              <p>{statusDetails(selectedLobby)}</p>
            </div>
            <div class="phase-indicator">
              <span>{bi("Текущая фаза", "Current phase")}</span>
              <strong>{statusLabel(selectedLobby.status)}</strong>
            </div>
          </section>

          <div class="stats">
            <div><small>{bi("Таймер", "Timer")}</small><strong>{selectedLobby.status.countDown ?? "—"}</strong></div>
            <div><small>{bi("Задания", "Tasks")}</small><strong>{Math.round(selectedLobby.taskProgression.displayed)}%</strong></div>
            <div><small>{bi("Игроки", "Players")}</small><strong>{participatingPlayers.length}</strong></div>
            <div><small>{bi("Живы", "Alive")}</small><strong>{aliveCount}</strong></div>
            <div><small>{bi("Симуляции", "Simulations")}</small><strong>{simulatedCount}</strong></div>
          </div>

          <section class="panel situation-panel">
            <div class="panel-heading">
              <div><p class="eyebrow">{bi("Состояние системы", "System status")}</p><h2>{bi("Активные эффекты", "Active effects")}</h2></div>
              <span class:alert={hasActiveSabotage} class="system-status">
                {hasActiveSabotage ? bi("ТРЕВОГА", "ALERT") : bi("НОРМА", "NORMAL")}
              </span>
            </div>
            <div class="effect-grid">
              <article class:active-effect={selectedLobby.activeEffects.firewallBreach}>
                <span>{bi("Защита", "Firewall")}</span>
                <strong>
                  {selectedLobby.activeEffects.firewallBreach
                    ? bi(`${selectedLobby.activeEffects.firewallBreach.countDown} сек.`, `${selectedLobby.activeEffects.firewallBreach.countDown}s`)
                    : bi("работает", "online")}
                </strong>
              </article>
              <article class:active-effect={selectedLobby.adminState?.virusScanActive}>
                <span>{bi("Вирусная проверка", "Virus scan")}</span>
                <strong>
                  {selectedLobby.adminState?.virusScanActive
                    ? bi(`${selectedLobby.adminState.virusScanSecondsLeft} сек.`, `${selectedLobby.adminState.virusScanSecondsLeft}s`)
                    : bi("неактивна", "inactive")}
                </strong>
              </article>
              <article class:active-effect={selectedLobby.activeEffects.hacked}>
                <span>{bi("Взлом игроков", "Player hack")}</span>
                <strong>
                  {selectedLobby.activeEffects.hacked
                    ? bi(`${selectedLobby.activeEffects.hacked.affectedPlayers.length} целей`, `${selectedLobby.activeEffects.hacked.affectedPlayers.length} targets`)
                    : bi("неактивен", "inactive")}
                </strong>
              </article>
            </div>
            {#if hasActiveSabotage}
              <button
                class="warning-button"
                on:click={() =>
                  runAction(
                    "clearSabotage",
                    {},
                    bi("Принудительно остановить активный саботаж?", "Force-stop the active sabotage?")
                  )}
              >
                {bi("Аварийно остановить саботаж", "Emergency stop sabotage")}
              </button>
            {/if}
          </section>

          <section class="panel">
            <div class="panel-heading">
              <div><p class="eyebrow">{bi("Состав операции", "Operation roster")}</p><h2>{bi("Игроки", "Players")}</h2></div>
              <span>{bi("Роли видны только ведущему", "Roles are visible only to the host")}</span>
            </div>
            <div class="players">
              {#each selectedPlayers as player}
                <article class="player-card">
                  <div class="player-identity">
                    <span
                      class="player-dot"
                      style={`--player-color: ${colorValue(player.color)}`}
                    ></span>
                    <div>
                      <strong>{player.name}</strong>
                      <small>
                        {colorLabel(player.color)} · {player.isHostOnly ? bi("только управляет", "manages only") : player.isSimulated ? bi("симуляция", "simulation") : player.connection === "connected" ? bi("на связи", "online") : bi("не в сети", "offline")}
                      </small>
                    </div>
                  </div>

                  <div class="player-data">
                    <span><small>{bi("Роль", "Role")}</small>{player.isHostOnly ? bi("ведущий", "host") : roleLabel(player.role.name)}</span>
                    <span><small>{bi("Действие", "Activity")}</small>{player.isHostOnly ? bi("управляет матчем", "managing match") : activityLabel(player)}</span>
                    <span><small>{bi("Задания", "Tasks")}</small>{player.isHostOnly ? "—" : taskSummary(player)}</span>
                    {#if player.role.name === "impostor"}
                      <span><small>{bi("Убийство / саботаж", "Elimination / sabotage")}</small>{player.role.killCooldown} / {player.role.sabotageCooldown}</span>
                    {/if}
                  </div>

                  <div class="player-controls">
                    {#if player.isHostOnly}
                      <div class="host-control-note">
                        {bi("Не участвует в игровых действиях", "Does not take part in game actions")}
                      </div>
                    {:else}
                      <label>
                        <span>{bi("Статус", "Status")}</span>
                        <select
                          value={player.status}
                          on:change={(event) =>
                            runAction(
                              "setPlayerStatus",
                              {
                                color: player.color,
                                status: event.currentTarget.value,
                              },
                              bi(`Изменить статус игрока ${player.name}?`, `Change ${player.name}'s status?`)
                            )}
                        >
                          <option value="alive">{bi("Жив", "Alive")}</option>
                          <option value="dead">{bi("Убит, тело не найдено", "Dead, body not found")}</option>
                          <option value="foundDead">{bi("Погиб", "Dead")}</option>
                        </select>
                      </label>
                      {#if selectedLobby.testMode.enabled && player.role.name !== "undecided"}
                        <label>
                          <span>{bi("Роль", "Role")}</span>
                          <select
                            value={player.role.name}
                            on:change={(event) =>
                              runAction("setPlayerRole", {
                                color: player.color,
                                role: event.currentTarget.value,
                              })}
                          >
                            <option value="crew">{bi("Оперативник", "Operative")}</option>
                            <option value="impostor">{bi("Внедрённый агент", "Infiltrated agent")}</option>
                          </select>
                        </label>
                      {/if}
                      {#if player.connection === "disconnected" && !player.isSimulated && ["settingRooms", "inLobby"].includes(selectedLobby.status.state)}
                        <button
                          class="remove-player-button"
                          on:click={() =>
                            runAction(
                              "removeDisconnectedPlayer",
                              { color: player.color },
                              bi(`Удалить отключившегося игрока ${player.name} из лобби?`, `Remove disconnected player ${player.name} from the lobby?`)
                            )}
                        >
                          {bi("Удалить из лобби", "Remove from lobby")}
                        </button>
                      {/if}
                    {/if}
                  </div>
                  <span class={`status-chip ${player.isHostOnly ? "host-only" : player.status}`}>
                    {player.isHostOnly ? bi("ВЕДУЩИЙ", "HOST") : playerStatusLabel(player.status)}
                  </span>
                </article>
              {/each}
            </div>
          </section>

          <section class="panel controls-panel">
            <div class="panel-heading">
              <div><p class="eyebrow">{bi("Управление", "Controls")}</p><h2>{bi("Матч", "Match")}</h2></div>
              <span>{bi("Опасные действия требуют подтверждения", "Risky actions require confirmation")}</span>
            </div>
            <div class="control-groups">
              <div class="control-group">
                <h3>{bi("Фаза", "Phase")}</h3>
                {#if canPauseMatch}
                  <button
                    class:pause-active={selectedLobby.pause?.active}
                    on:click={() =>
                      runAction(
                        "setPaused",
                        { active: !selectedLobby.pause?.active },
                        selectedLobby.pause?.active
                          ? bi("Продолжить матч и запустить таймеры?", "Resume the match and start all timers?")
                          : bi("Поставить матч на паузу и остановить все таймеры?", "Pause the match and stop all timers?")
                      )}
                  >
                    {selectedLobby.pause?.active ? bi("Продолжить матч", "Resume match") : bi("Поставить на паузу", "Pause match")}
                  </button>
                {/if}
                {#if canAdvancePhase}
                  <button
                    on:click={() =>
                      runAction(
                        "advancePhase",
                        {},
                        bi("Принудительно перейти к следующей фазе?", "Force the next phase?")
                      )}
                  >
                    {bi("Следующая фаза", "Next phase")}
                  </button>
                {/if}
                {#if selectedLobby.status.state !== "settingRooms"}
                  <button
                    on:click={() =>
                      runAction(
                        "resetGame",
                        {},
                        bi("Сбросить текущий матч и вернуть игроков в лобби?", "Reset the match and return all players to the lobby?")
                      )}
                  >
                    {bi("Сбросить в лобби", "Reset to lobby")}
                  </button>
                {/if}
              </div>

              {#if !["settingRooms", "inLobby", "gameEnded"].includes(selectedLobby.status.state)}
                <div class="control-group danger-group">
                  <h3>{bi("Завершение", "Finish")}</h3>
                  <button
                    on:click={() =>
                      runAction(
                        "endGame",
                        { victors: "crew" },
                        bi("Завершить игру победой оперативников?", "End the game with an operative victory?")
                      )}
                  >
                    {bi("Победа оперативников", "Operatives win")}
                  </button>
                  <button
                    on:click={() =>
                      runAction(
                        "endGame",
                        { victors: "impostor" },
                        bi("Завершить игру победой внедрённых агентов?", "End the game with an infiltrated-agent victory?")
                      )}
                  >
                    {bi("Победа агентов", "Agents win")}
                  </button>
                </div>
              {/if}
            </div>
          </section>

          <section class="panel test-panel" class:enabled={selectedLobby.testMode.enabled}>
            <div class="panel-heading">
              <div><p class="eyebrow">{bi("Репетиция", "Rehearsal")}</p><h2>{bi("Тестовый режим", "Test mode")}</h2></div>
              <span>{selectedLobby.testMode.enabled ? bi("включён", "enabled") : bi("выключен", "disabled")}</span>
            </div>

            {#if selectedLobby.status.state === "settingRooms"}
              <p class="panel-description">
                {bi(
                  "Создаст временную площадку, добавит три симуляции и переведёт лобби к запуску. Сохранённый физический шаблон не изменится.",
                  "Creates a temporary venue, adds three simulated players, and prepares the lobby to start. The saved physical template is not changed."
                )}
              </p>
              <button
                class="primary-button"
                on:click={() => runAction("prepareTestLobby", { botCount: 3 })}
              >
                {bi("Подготовить тестовое лобби", "Prepare test lobby")}
              </button>
            {:else if selectedLobby.status.state === "inLobby" || selectedLobby.status.state === "gameEnded"}
              <button
                on:click={() =>
                  runAction("setTestMode", {
                    enabled: !selectedLobby.testMode.enabled,
                  })}
              >
                {selectedLobby.testMode.enabled
                  ? bi("Выключить тестовый режим", "Disable test mode")
                  : bi("Включить тестовый режим", "Enable test mode")}
              </button>
            {/if}

            {#if selectedLobby.testMode.enabled}
              <div class="test-actions">
                {#if selectedLobby.status.state === "inLobby"}
                  <button on:click={() => runAction("addTestPlayers", { count: 1 })}>+ 1 {bi("симуляция", "simulation")}</button>
                  <button on:click={() => runAction("addTestPlayers", { count: 3 })}>+ 3 {bi("симуляции", "simulations")}</button>
                  <button on:click={() => runAction("removeTestPlayers")}>{bi("Удалить симуляции", "Remove simulations")}</button>
                  <button class="primary-button" on:click={() => runAction("startTestGame")}>
                    {bi("Запустить тестовую игру", "Start test game")}
                  </button>
                {/if}

                {#if selectedLobby.status.state === "started"}
                  <button on:click={() => runAction("resetCooldowns")}>{bi("Сбросить кулдауны", "Reset cooldowns")}</button>
                  <button on:click={() => runAction("addTaskProgress")}>+ {bi("прогресс задания", "task progress")}</button>
                  <button on:click={() => runAction("callMeeting")}>{bi("Имитировать собрание", "Simulate meeting")}</button>
                  <button on:click={() => runAction("launchSabotage", { kind: "virusScan" })}>{bi("Вирусная проверка", "Virus scan")}</button>
                  <button on:click={() => runAction("launchSabotage", { kind: "firewallBreach" })}>{bi("Взлом защиты", "Firewall breach")}</button>
                {/if}
              </div>

              <div class="minigame-launcher">
                <div>
                  <h3>{bi("Проверка мини-игр", "Minigame testing")}</h3>
                  <p>{bi("Запускаются отдельно и не меняют прогресс матча.", "Runs separately without changing match progress.")}</p>
                </div>
                <div class="minigame-grid">
                  {#each testMinigames as game}
                    <button type="button" on:click={() => startTestMinigame(game.id)}>
                      <span class="minigame-number">{game.id + 1}</span>
                      <span class="minigame-name">{bi(game.ru, game.en)}</span>
                    </button>
                  {/each}
                </div>
              </div>

              <p class="test-note">
                {bi(
                  "Таймеры ролей, собрания, убийства, саботажа и защиты сокращены только для этого лобби.",
                  "Role, meeting, elimination, sabotage, and firewall timers are shortened only for this lobby."
                )}
              </p>
            {/if}
          </section>

          <section class="panel">
            <div class="panel-heading">
              <div><p class="eyebrow">{bi("Диагностика", "Diagnostics")}</p><h2>{bi("Журнал событий", "Event log")}</h2></div>
              <span>{bi("Последние 100 событий", "Latest 100 events")}</span>
            </div>
            <div class="event-log">
              {#each [...(selectedLobby.eventLog || [])].reverse() as event}
                <div>
                  <time>{new Date(event.timestamp).toLocaleTimeString($language === "en" ? "en-GB" : "ru-RU")}</time>
                  <span>{eventMessage(event)}</span>
                  <small>{eventTypeLabel(event.type)}</small>
                </div>
              {/each}
              {#if !selectedLobby.eventLog?.length}
                <p class="muted">{bi("Событий пока нет.", "No events yet.")}</p>
              {/if}
            </div>
          </section>
        </section>
      {:else}
        <section class="empty-state">
          <h2>{bi("Активных лобби нет", "No active lobbies")}</h2>
          <p>{bi("Создайте игру, после чего она появится здесь автоматически.", "Create a game and it will appear here automatically.")}</p>
        </section>
      {/if}
      </div>
    {/if}
  {/if}
</main>

<style>
  :global(html.admin-scroll-root),
  :global(body.admin-scroll-root) {
    background: #050505;
    overflow-y: auto !important;
    overscroll-behavior-y: auto;
  }

  .admin-dashboard {
    width: 100%;
    height: var(--app-height);
    min-height: 0;
    padding:
      max(18px, var(--safe-top))
      max(18px, var(--safe-right))
      max(22px, var(--safe-bottom))
      max(18px, var(--safe-left));
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    color: white;
    background:
      radial-gradient(circle at 10% 0, rgba(34, 197, 94, 0.14), transparent 30rem),
      radial-gradient(circle at 90% 15%, rgba(59, 130, 246, 0.1), transparent 28rem),
      #050505;
  }

  .login-card {
    width: min(100%, 500px);
    margin: clamp(24px, 10vh, 110px) auto;
    padding: clamp(22px, 5vw, 34px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 26px;
    background: rgba(11, 11, 11, 0.98);
    box-shadow: 0 28px 100px rgba(0, 0, 0, 0.5);
  }

  .eyebrow,
  small {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 5px 0 10px;
    font-size: clamp(30px, 6vw, 42px);
    font-weight: 900;
    line-height: 1;
  }

  h2 {
    margin: 2px 0;
    font-size: 20px;
    font-weight: 900;
  }

  h3 {
    margin: 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .lead,
  .panel-description,
  .test-note {
    color: rgba(255, 255, 255, 0.62);
    line-height: 1.55;
  }

  .minigame-launcher {
    margin-top: 14px;
    padding: 13px;
    border: 1px solid rgba(96, 165, 250, 0.2);
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.38);
  }

  .minigame-launcher h3 {
    margin: 0;
    font-size: 14px;
  }

  .minigame-launcher p {
    margin: 4px 0 11px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
  }

  .minigame-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
    gap: 7px;
  }

  .minigame-grid button {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
  }

  .minigame-grid button .minigame-number {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 8px;
    background: rgba(96, 165, 250, 0.16);
    color: #bfdbfe;
    font-size: 10px;
  }

  .minigame-grid button .minigame-name {
    min-width: 0;
    color: inherit;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  input,
  select {
    min-width: 0;
    padding: 11px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 11px;
    background: #f8fafc;
    color: #111827;
  }

  button {
    min-height: 42px;
    padding: 10px 13px;
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 12px;
    background: rgba(34, 197, 94, 0.11);
    color: white;
    font-weight: 800;
    cursor: pointer;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.5;
  }

  .primary-button {
    border-color: rgba(74, 222, 128, 0.7);
    background: #16a34a;
  }

  .ghost-button {
    border-color: rgba(255, 255, 255, 0.13);
    background: rgba(255, 255, 255, 0.045);
  }

  .login-card > button {
    width: 100%;
    margin-top: 9px;
  }

  .secret-field {
    display: grid;
    gap: 7px;
  }

  .secret-field span {
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
    font-weight: 800;
  }

  .divider {
    position: relative;
    margin: 20px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.09);
    text-align: center;
  }

  .divider span {
    position: relative;
    top: -10px;
    padding: 0 10px;
    color: rgba(255, 255, 255, 0.38);
    background: #0b0b0b;
  }

  .topbar {
    max-width: 1400px;
    margin: 0 auto 18px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
  }

  .topbar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dashboard-tabs,
  .preflight-content {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto 14px;
  }

  .dashboard-tabs {
    padding: 7px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 16px;
    background: rgba(12, 12, 12, 0.96);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .tab-buttons {
    min-width: 0;
    display: flex;
    gap: 6px;
  }

  .dashboard-tabs button {
    border-color: transparent;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
  }

  .dashboard-tabs button.active {
    border-color: rgba(74, 222, 128, 0.45);
    background: rgba(22, 101, 52, 0.3);
    color: #bbf7d0;
  }

  .tab-lobby-picker {
    min-width: min(100%, 260px);
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .tab-lobby-picker span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
    font-weight: 850;
  }

  .tab-lobby-picker select {
    width: 100%;
    padding: 8px;
  }

  .mode-badge,
  .system-status,
  .status-chip {
    padding: 7px 10px;
    border: 1px solid rgba(74, 222, 128, 0.35);
    border-radius: 999px;
    color: #86efac;
    background: rgba(22, 101, 52, 0.2);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .mode-badge.test-badge,
  .system-status.alert {
    border-color: rgba(251, 191, 36, 0.45);
    color: #fde68a;
    background: rgba(146, 64, 14, 0.25);
  }

  .dashboard-grid {
    max-width: 1400px;
    margin: auto;
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 16px;
  }

  .dashboard-grid:not(:has(.lobby-list)) {
    grid-template-columns: minmax(0, 1fr);
  }

  .lobby-list,
  .panel,
  .mission-header,
  .empty-state {
    padding: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    background: rgba(12, 12, 12, 0.96);
  }

  .lobby-list {
    align-self: start;
    display: grid;
    gap: 8px;
  }

  .lobby-list button {
    display: grid;
    gap: 4px;
    text-align: left;
  }

  .lobby-list button.active {
    border-color: #4ade80;
    background: rgba(34, 197, 94, 0.22);
  }

  .content {
    min-width: 0;
    display: grid;
    gap: 14px;
  }

  .mission-header {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
  }

  .mission-header p {
    margin: 5px 0 0;
    color: rgba(255, 255, 255, 0.56);
  }

  .phase-indicator {
    min-width: 210px;
    padding: 14px;
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 14px;
    background: rgba(34, 197, 94, 0.07);
    display: grid;
    gap: 4px;
  }

  .phase-indicator span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .phase-indicator strong {
    color: #86efac;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 9px;
  }

  .stats div {
    min-width: 0;
    padding: 15px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 15px;
    background: #0c0c0c;
    display: grid;
    gap: 5px;
  }

  .stats strong {
    overflow: hidden;
    color: #86efac;
    font-size: clamp(18px, 3vw, 24px);
    text-overflow: ellipsis;
  }

  .panel-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 13px;
  }

  .panel-heading > span {
    color: rgba(255, 255, 255, 0.43);
    font-size: 12px;
  }

  .effect-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .effect-grid article {
    padding: 13px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.025);
    display: grid;
    gap: 5px;
  }

  .effect-grid article span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
    text-transform: uppercase;
  }

  .effect-grid article.active-effect {
    border-color: rgba(248, 113, 113, 0.4);
    background: rgba(127, 29, 29, 0.18);
  }

  .warning-button {
    width: 100%;
    margin-top: 10px;
    border-color: rgba(248, 113, 113, 0.5);
    background: rgba(127, 29, 29, 0.28);
  }

  .players {
    display: grid;
    gap: 8px;
  }

  .player-card {
    position: relative;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 15px;
    background: rgba(255, 255, 255, 0.025);
    display: grid;
    grid-template-columns: minmax(180px, 1.2fr) minmax(250px, 2fr) minmax(170px, 1fr);
    gap: 14px;
    align-items: center;
  }

  .player-identity {
    min-width: 0;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .player-identity div {
    min-width: 0;
    display: grid;
  }

  .player-identity strong {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .player-dot {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    border: 2px solid rgba(255, 255, 255, 0.38);
    border-radius: 50%;
    background: var(--player-color);
    box-shadow: 0 0 14px color-mix(in srgb, var(--player-color), transparent 45%);
  }

  .player-data {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .player-data span {
    min-width: 0;
    display: grid;
    gap: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .player-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .player-controls label {
    display: grid;
    gap: 4px;
  }

  .player-controls label > span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .player-controls label:only-child {
    grid-column: 1 / -1;
  }

  .host-control-note {
    grid-column: 1 / -1;
    padding: 10px;
    border: 1px solid rgba(96, 165, 250, 0.2);
    border-radius: 10px;
    background: rgba(30, 64, 175, 0.1);
    color: #bfdbfe;
    font-size: 11px;
    line-height: 1.35;
    text-align: center;
  }

  .remove-player-button {
    grid-column: 1 / -1;
    border-color: rgba(248, 113, 113, 0.35);
    background: rgba(127, 29, 29, 0.2);
    color: #fecaca;
    font-size: 11px;
  }

  button.pause-active {
    border-color: rgba(74, 222, 128, 0.42);
    background: rgba(22, 101, 52, 0.25);
    color: #bbf7d0;
  }

  .status-chip {
    position: absolute;
    top: 7px;
    right: 8px;
    padding: 4px 7px;
    font-size: 9px;
  }

  .status-chip.dead,
  .status-chip.foundDead {
    border-color: rgba(248, 113, 113, 0.4);
    color: #fca5a5;
    background: rgba(127, 29, 29, 0.25);
  }

  .status-chip.host-only {
    border-color: rgba(96, 165, 250, 0.4);
    color: #bfdbfe;
    background: rgba(30, 64, 175, 0.25);
  }

  .control-groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .control-group {
    padding: 13px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .control-group h3 {
    width: 100%;
  }

  .danger-group button {
    border-color: rgba(248, 113, 113, 0.38);
    background: rgba(127, 29, 29, 0.2);
  }

  .test-panel {
    border-color: rgba(96, 165, 250, 0.22);
  }

  .test-panel.enabled {
    border-color: rgba(96, 165, 250, 0.5);
    background: linear-gradient(135deg, rgba(30, 64, 175, 0.16), rgba(12, 12, 12, 0.97));
  }

  .test-actions {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .test-note {
    margin: 12px 0 0;
    font-size: 12px;
  }

  .event-log {
    max-height: 360px;
    overflow-y: auto;
    display: grid;
    gap: 3px;
  }

  .event-log div {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 9px 7px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    align-items: baseline;
  }

  .event-log time {
    color: rgba(255, 255, 255, 0.4);
  }

  .error,
  .error-banner {
    color: #fca5a5;
    font-weight: 800;
  }

  .error-banner,
  .notice-banner {
    max-width: 1400px;
    margin: 0 auto 12px;
    padding: 12px;
    border-radius: 12px;
  }

  .error-banner {
    background: rgba(127, 29, 29, 0.3);
  }

  .notice-banner {
    color: #86efac;
    background: rgba(20, 83, 45, 0.3);
  }

  .muted {
    color: rgba(255, 255, 255, 0.55);
  }

  @media (max-width: 1050px) {
    .player-card {
      grid-template-columns: 1fr 1.5fr;
    }

    .player-controls {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 820px) {
    .admin-dashboard {
      padding: 12px;
    }

    .topbar,
    .mission-header {
      align-items: stretch;
      flex-direction: column;
    }

    .topbar-actions {
      flex-wrap: wrap;
    }

    .dashboard-tabs {
      align-items: stretch;
      flex-direction: column;
    }

    .tab-buttons button {
      flex: 1;
    }

    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .lobby-list {
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    }

    .lobby-list h2,
    .lobby-list .muted {
      grid-column: 1 / -1;
    }

    .stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .effect-grid,
    .control-groups {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 580px) {
    .tab-buttons {
      display: grid;
      grid-template-columns: 1fr;
    }

    .topbar-actions button {
      flex: 1;
    }

    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stats div:last-child {
      grid-column: 1 / -1;
    }

    .panel,
    .mission-header {
      padding: 14px;
      border-radius: 17px;
    }

    .panel-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .player-card {
      grid-template-columns: 1fr;
      padding-top: 35px;
    }

    .player-data {
      grid-template-columns: 1fr 1fr;
    }

    .player-controls {
      grid-column: auto;
      grid-template-columns: 1fr;
    }

    .event-log div {
      grid-template-columns: 70px minmax(0, 1fr);
    }

    .event-log small {
      display: none;
    }

    .test-actions button,
    .control-group button {
      width: 100%;
    }
  }
</style>
