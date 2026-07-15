import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { io as createSocket } from "socket.io-client";
import { NFC_ACTIVITIES } from "./consts.js";

const port = 32000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const adminSecret = "integration-secret";
const sockets = new Set();
let serverProcess;

function waitForEvent(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timeout);
      resolve(payload);
    }

    socket.once(event, onEvent);
  });
}

function emitAck(socket, event, payload = undefined, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event} acknowledgement`)),
      timeoutMs
    );
    const acknowledge = (result) => {
      clearTimeout(timeout);
      resolve(result);
    };

    if (payload === undefined) socket.emit(event, acknowledge);
    else socket.emit(event, payload, acknowledge);
  });
}

async function connectSocket(url = baseUrl) {
  const socket = createSocket(url, {
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });
  sockets.add(socket);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out connecting to ${url}`)),
      4000
    );
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(new Error(`Could not connect to ${url}: ${error.message}`));
    };
    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
  return socket;
}

async function startServer(serverPort, overrides = {}) {
  const environment = { ...process.env, ...overrides, PORT: String(serverPort) };
  if (overrides.NODE_TEST_CONTEXT === null) {
    delete environment.NODE_TEST_CONTEXT;
  }
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.testOutput = () => output;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Server did not start. Output:\n${output}`)),
      5000
    );
    const collect = (chunk) => {
      output += chunk.toString();
      if (output.includes(`Listening on http://localhost:${serverPort}`)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. Output:\n${output}`));
    });
  });

  return child;
}

async function stopServer(child) {
  if (child == null || child.exitCode != null) return;
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function createLobby(socket, name, hostParticipates = true) {
  const joined = waitForEvent(socket, "joinedLobby");
  socket.emit("createLobby", { name, hostParticipates });
  return joined;
}

async function joinLobby(socket, name, lobbyId) {
  const joined = waitForEvent(socket, "joinedLobby");
  socket.emit("joinLobby", { name, lobbyId });
  return joined;
}

test.before(async () => {
  serverProcess = await startServer(port, {
      NODE_ENV: "test",
      MIN_PLAYERS: "2",
      ADMIN_SECRET: adminSecret,
      ALLOWED_ORIGINS: baseUrl,
  });
});

test.after(async () => {
  for (const socket of sockets) socket.disconnect();
  await stopServer(serverProcess);
});

test("production HTTP routes and full Socket.IO session flow stay operational", async () => {
  for (const route of ["/", "/admin/", "/scan?tag=task:value.with.dot"]) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /Протокол 150|Protocol 150/);
  }

  const socketEndpoint = `${baseUrl}/socket.io/?EIO=4&transport=polling`;
  const allowedCors = await fetch(socketEndpoint, {
    method: "OPTIONS",
    headers: { Origin: baseUrl, "Access-Control-Request-Method": "GET" },
  });
  assert.equal(allowedCors.headers.get("access-control-allow-origin"), baseUrl);
  const deniedCors = await fetch(socketEndpoint, {
    method: "OPTIONS",
    headers: {
      Origin: "https://untrusted.example",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(deniedCors.headers.get("access-control-allow-origin"), null);

  const malformed = await connectSocket();
  const malformedError = waitForEvent(malformed, "error");
  malformed.emit("createLobby");
  assert.equal((await malformedError).error, "Введите ник.");
  const nullPayloadError = waitForEvent(malformed, "error");
  malformed.emit("createLobby", null);
  assert.equal((await nullPayloadError).error, "Введите ник.");
  malformed.emit("startGame", { unexpected: true });

  const host = await connectSocket();
  const hostSession = await createLobby(host, "Host Tester");
  const guest = await connectSocket();
  const guestSession = await joinLobby(guest, "Guest Тест", hostSession.lobby.id);

  const guestSetup = await emitAck(guest, "setActivities", { activities: {} });
  assert.equal(guestSetup.success, false);
  assert.equal(guestSetup.message, "Только ведущий может настраивать площадку.");

  const invalidActivities = Object.fromEntries(
    NFC_ACTIVITIES.map((name) => [name, { room: `Room ${name}` }])
  );
  invalidActivities.meeting.room = 150;
  const invalidSetup = await emitAck(host, "setActivities", {
    activities: invalidActivities,
  });
  assert.equal(invalidSetup.success, false);
  assert.match(invalidSetup.message, /Локация для meeting/);

  const activities = Object.fromEntries(
    NFC_ACTIVITIES.map((name, index) => [name, { room: `Room ${index + 1}` }])
  );
  assert.deepEqual(
    await emitAck(host, "setActivities", { activities }),
    { success: true }
  );

  const earlyStart = await emitAck(host, "startGame");
  assert.equal(earlyStart.success, false);
  assert.equal(
    earlyStart.message,
    "Перед стартом все игроки должны подтвердить готовность."
  );

  assert.equal(
    (await emitAck(guest, "gameAction", { action: "playerReady" })).success,
    true
  );

  const deniedHostPanel = await emitAck(guest, "hostAuthenticate", {
    gameInfo: {
      playerId: guestSession.id,
      lobbyId: guestSession.lobby.id,
      color: guestSession.color,
    },
  });
  assert.equal(deniedHostPanel.success, false);

  const hostAuthentication = await emitAck(host, "hostAuthenticate", {
    gameInfo: {
      playerId: hostSession.id,
      lobbyId: hostSession.lobby.id,
      color: hostSession.color,
    },
  });
  assert.equal(hostAuthentication.success, true);

  assert.equal(
    (
      await emitAck(host, "adminAction", {
        lobbyId: hostSession.lobby.id,
        action: "setTestMode",
        enabled: true,
      })
    ).success,
    true
  );

  assert.equal((await emitAck(host, "startGame")).success, true);
  const adminSnapshot = await emitAck(host, "adminRefresh");
  assert.equal(adminSnapshot.success, true);
  assert.ok(
    Object.values(adminSnapshot.lobbies[0].players).every(
      (player) => player.role.name !== "undecided"
    )
  );

  assert.equal(
    (
      await emitAck(host, "adminAction", {
        lobbyId: hostSession.lobby.id,
        action: "advancePhase",
      })
    ).success,
    true
  );

  const playersByColor = adminSnapshot.lobbies[0].players;
  const impostor = Object.values(playersByColor).find(
    (player) => player.role.name === "impostor"
  );
  const operative = Object.values(playersByColor).find(
    (player) => player.role.name === "crew"
  );
  assert.ok(impostor);
  assert.ok(operative);

  const socketByColor = {
    [hostSession.color]: host,
    [guestSession.color]: guest,
  };
  const impostorSocket = socketByColor[impostor.color];
  const operativeSocket = socketByColor[operative.color];
  assert.ok(impostorSocket);
  assert.ok(operativeSocket);

  assert.equal(
    (
      await emitAck(impostorSocket, "gameAction", {
        action: "requestPlayerSync",
        targetColor: operative.color,
        mode: "sync",
      })
    ).success,
    true
  );
  assert.equal(
    (
      await emitAck(operativeSocket, "gameAction", {
        action: "requestPlayerSync",
        targetColor: impostor.color,
        mode: "sync",
      })
    ).success,
    true
  );
  await new Promise((resolve) => setTimeout(resolve, 3300));

  const progressionBeforeFakeTask = (
    await emitAck(host, "adminRefresh")
  ).lobbies[0].taskProgression.real;
  const fakeTaskNumber = impostor.tasks[0].number;
  assert.equal(
    (
      await emitAck(impostorSocket, "gameAction", {
        action: "startTask",
        taskNumber: fakeTaskNumber,
      })
    ).success,
    true
  );
  assert.equal(
    (
      await emitAck(impostorSocket, "gameAction", {
        action: "taskCompleted",
        taskNumber: fakeTaskNumber,
      })
    ).success,
    true
  );
  assert.equal(
    (await emitAck(host, "adminRefresh")).lobbies[0].taskProgression.real,
    progressionBeforeFakeTask
  );

  const operativeTaskNumber = operative.tasks[0].number;
  assert.equal(
    (
      await emitAck(operativeSocket, "gameAction", {
        action: "startTask",
        taskNumber: operativeTaskNumber,
      })
    ).success,
    true
  );
  assert.equal(
    (
      await emitAck(operativeSocket, "gameAction", {
        action: "taskCompleted",
        taskNumber: operativeTaskNumber,
      })
    ).success,
    true
  );
  assert.ok(
    (await emitAck(host, "adminRefresh")).lobbies[0].taskProgression.real >
      progressionBeforeFakeTask
  );

  assert.equal(
    (
      await emitAck(host, "adminAction", {
        lobbyId: hostSession.lobby.id,
        action: "setPaused",
        active: true,
      })
    ).success,
    true
  );
  assert.equal(
    (
      await emitAck(host, "adminAction", {
        lobbyId: hostSession.lobby.id,
        action: "setPaused",
        active: false,
      })
    ).success,
    true
  );

  const replacement = await connectSocket();
  const replaced = waitForEvent(guest, "sessionReplaced");
  const reconnected = waitForEvent(replacement, "reconnected");
  replacement.emit("reconnect", {
    playerId: guestSession.id,
    lobbyId: guestSession.lobby.id,
    color: guestSession.color,
  });
  assert.equal((await reconnected).success, true);
  await replaced;

  const staleAction = await emitAck(guest, "gameAction", {
    action: "callMeeting",
  });
  assert.equal(staleAction.success, false);
  assert.equal(staleAction.code, "STALE_SESSION");

  replacement.disconnect();
  const restored = await connectSocket();
  const restoredEvent = waitForEvent(restored, "reconnected");
  restored.emit("reconnect", {
    playerId: guestSession.id,
    lobbyId: guestSession.lobby.id,
    color: guestSession.color,
  });
  assert.equal((await restoredEvent).success, true);

  const globalAdmin = await connectSocket();
  assert.equal(
    (await emitAck(globalAdmin, "adminAuthenticate", { secret: "wrong" }))
      .success,
    false
  );
  assert.equal(
    (
      await emitAck(globalAdmin, "adminAuthenticate", {
        secret: adminSecret,
      })
    ).success,
    true
  );

  const restartResult = await emitAck(globalAdmin, "restartLobby");
  assert.equal(restartResult.success, false);
  assert.equal((await emitAck(globalAdmin, "adminRefresh")).success, true);
});

test("lobby state survives a graceful production server restart", async () => {
  const persistencePort = port + 1000;
  const persistenceUrl = `http://127.0.0.1:${persistencePort}`;
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "protocol-150-persistence-")
  );
  const stateFile = path.join(temporaryDirectory, "lobbies.json");
  const environment = {
    NODE_ENV: "production",
    NODE_TEST_CONTEXT: null,
    ADMIN_SECRET: adminSecret,
    ALLOWED_ORIGINS: persistenceUrl,
    LOBBY_STATE_FILE: stateFile,
  };
  let processUnderTest = await startServer(persistencePort, environment);

  try {
    let creatorSocket;
    try {
      creatorSocket = await connectSocket(persistenceUrl);
    } catch (error) {
      throw new Error(`${error.message}\nServer output:\n${processUnderTest.testOutput()}`);
    }
    const creatorSession = await createLobby(
      creatorSocket,
      "Persistent Host",
      false
    );
    creatorSocket.disconnect();

    await stopServer(processUnderTest);
    assert.equal(fs.existsSync(stateFile), true);
    assert.equal(JSON.parse(fs.readFileSync(stateFile, "utf8")).version, 1);

    processUnderTest = await startServer(persistencePort, environment);
    let admin;
    try {
      admin = await connectSocket(persistenceUrl);
    } catch (error) {
      throw new Error(`${error.message}\nServer output:\n${processUnderTest.testOutput()}`);
    }
    const authentication = await emitAck(admin, "adminAuthenticate", {
      secret: adminSecret,
    });
    assert.equal(authentication.success, true);
    assert.equal(authentication.lobbies.length, 1);
    assert.equal(authentication.lobbies[0].creator, "Persistent Host");

    const restoredCreator = await connectSocket(persistenceUrl);
    const restored = waitForEvent(restoredCreator, "reconnected");
    restoredCreator.emit("reconnect", {
      playerId: creatorSession.id,
      lobbyId: creatorSession.lobby.id,
      color: creatorSession.color,
    });
    assert.equal((await restored).success, true);
  } finally {
    await stopServer(processUnderTest);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
