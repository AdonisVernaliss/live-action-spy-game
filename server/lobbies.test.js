import assert from "node:assert/strict";
import test from "node:test";
import { Lobby } from "./lobbies.js";
import { Player, playerNameValid } from "./player.js";
import {
  NFC_ACTIVITIES,
  NFC_ACTIVITY_TAGS,
  TEST_MODE_TIMERS,
} from "./consts.js";

function makePlayer(color, role) {
  const player = new Player({
    name: `Player${color}`,
    connection: "connected",
    status: "alive",
    color,
  });
  player.role = role;
  return player;
}

function makeLobby(players, status) {
  return new Lobby({
    id: "test-lobby",
    players: Object.fromEntries(players.map((player) => [player.color, player])),
    creator: players[0].name,
    status,
  });
}

test("a meeting interrupts active player activities and clears hacks", () => {
  const green = makePlayer("green", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  green.currentlyDoing = { activity: "task", number: 1 };

  const lobby = makeLobby([green, red], { state: "started", countDown: 0 });
  lobby.activeEffects.hacked = { affectedPlayers: ["green"] };

  lobby.startMeetingCall("emergency", "green");

  assert.deepEqual(green.currentlyDoing, { activity: "nothing" });
  assert.equal(lobby.activeEffects.hacked, null);
  assert.equal(lobby.status.state, "meetingCalled");
  lobby.destroy();
});

test("the last submitted vote closes voting immediately", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  const lobby = makeLobby([green, blue, red], {
    state: "meetingCalled",
    type: "emergency",
    caller: "green",
    presentPlayers: { green: true, blue: true, red: true },
    deadPlayer: null,
  });

  lobby.startMeeting();
  lobby.addVote("green", "skip");
  lobby.addVote("blue", "skip");
  lobby.addVote("red", "green");

  assert.equal(lobby.status.state, "voteResultAnnounced");
  assert.equal(lobby.status.votedOutPlayer, null);
  lobby.destroy();
});

test("impostors win as soon as they reach parity with crew", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  const lobby = makeLobby([green, blue, red], { state: "started", countDown: 0 });

  assert.deepEqual(lobby.killPlayer("green", "red"), [true]);
  assert.equal(lobby.status.state, "gameEnded");
  assert.equal(lobby.status.victors, "impostor");
  lobby.destroy();
});

test("mutual player scans start a private timed synchronization for both players", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const lobby = makeLobby([green, blue], { state: "started", countDown: 0 });

  assert.deepEqual(lobby.requestPlayerSync("green", "blue", "sync"), [true]);
  assert.equal(lobby.serializeForPlayer("green").playerSync.state, "waiting");
  assert.equal(lobby.serializeForPlayer("blue").playerSync.state, "incoming");

  assert.deepEqual(lobby.requestPlayerSync("blue", "green", "sync"), [true]);
  const greenSync = lobby.serializeForPlayer("green").playerSync;
  const blueSync = lobby.serializeForPlayer("blue").playerSync;
  assert.equal(greenSync.state, "active");
  assert.equal(blueSync.state, "active");
  assert.equal(greenSync.partnerColor, "blue");
  assert.equal(blueSync.partnerColor, "green");
  assert.equal("covertAction" in greenSync, false);

  assert.deepEqual(lobby.finishPlayerSync(greenSync.sessionId), [true]);
  assert.equal(green.syncTask.completed, true);
  assert.equal(blue.syncTask.completed, true);
  assert.equal(lobby.serializeForPlayer("green").playerSync.state, "completed");
  lobby.destroy();
});

test("a covert synchronization looks normal to the target and eliminates only at completion", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const yellow = makePlayer("yellow", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  const lobby = makeLobby([green, blue, yellow, red], {
    state: "started",
    countDown: 0,
  });

  assert.deepEqual(
    lobby.requestPlayerSync("red", "green", "eliminate"),
    [true]
  );
  assert.equal(green.status, "alive");
  assert.deepEqual(lobby.requestPlayerSync("green", "red", "sync"), [true]);

  const targetView = lobby.serializeForPlayer("green").playerSync;
  assert.equal(targetView.state, "active");
  assert.equal(JSON.stringify(targetView).includes("eliminate"), false);
  assert.equal(green.status, "alive");

  assert.deepEqual(lobby.finishPlayerSync(targetView.sessionId), [true]);
  assert.equal(green.status, "dead");
  assert.equal(red.syncTask.completed, true);
  assert.ok(red.role.killCooldown > 0);
  lobby.destroy();
});

test("a meeting cancels synchronization before its delayed result", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  const lobby = makeLobby([green, blue, red], {
    state: "started",
    countDown: 0,
  });

  lobby.requestPlayerSync("red", "green", "eliminate");
  lobby.requestPlayerSync("green", "red", "sync");
  const sessionId = lobby.serializeForPlayer("green").playerSync.sessionId;

  lobby.startMeetingCall("emergency", "blue");
  assert.equal(lobby.status.state, "meetingCalled");
  assert.equal(lobby.finishPlayerSync(sessionId)[0], false);
  assert.equal(green.status, "alive");
  lobby.destroy();
});

test("player snapshots hide other roles while admin snapshots reveal them", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 10,
    sabotageCooldown: 20,
  });
  const lobby = makeLobby([green, blue, red], { state: "started", countDown: 0 });

  const crewView = lobby.serializeForPlayer("green");
  assert.equal(crewView.players.green.role.name, "crew");
  assert.equal(crewView.players.red.role.name, "undecided");
  assert.equal(crewView.players.blue.role.name, "undecided");

  const adminView = lobby.serializeAdmin();
  assert.equal(adminView.players.red.role.name, "impostor");
  assert.equal(adminView.players.blue.role.name, "crew");
  lobby.destroy();
});

test("Russian and mixed Unicode nicknames are accepted", () => {
  assert.equal(playerNameValid("Агент Мария")[0], true);
  assert.equal(playerNameValid("Иван-150")[0], true);
  assert.equal(playerNameValid("Spy_Алекс")[0], true);
  assert.equal(playerNameValid("!!!")[0], false);
});

test("cycling tasks selects real task numbers outside the previous batch", () => {
  const player = makePlayer("green", { name: "crew" });
  player.tasks = [0, 1, 2].map((number) => ({ number }));
  const activities = Object.fromEntries(
    NFC_ACTIVITIES.map((name, index) => [
      name,
      { id: index + 1, name, room: `Room ${index + 1}` },
    ])
  );
  const originalRandom = Math.random;

  try {
    Math.random = () => 0;
    player.assignTasks(activities);
  } finally {
    Math.random = originalRandom;
  }

  assert.deepEqual(
    player.tasks.map((task) => task.number),
    [3, 4, 5]
  );
  assert.ok(player.tasks.every((task) => task.description.includes("Room")));
});

test("venue setup normalizes rooms and rejects malformed imports", () => {
  const host = makePlayer("green", { name: "undecided" });
  const lobby = makeLobby([host], { state: "settingRooms", readyPlayers: {} });
  const activities = Object.fromEntries(
    NFC_ACTIVITIES.map((name, index) => [
      name,
      { id: 999, name: "untrusted", room: `  Room ${index + 1}  ` },
    ])
  );

  const malformed = structuredClone(activities);
  malformed.meeting.room = 150;
  assert.equal(lobby.setActivities(malformed)[0], false);
  assert.equal(lobby.status.state, "settingRooms");
  assert.equal(lobby.activities, null);

  assert.deepEqual(lobby.setActivities(activities), [true]);
  assert.equal(lobby.status.state, "inLobby");
  assert.deepEqual(lobby.activities.meeting, {
    id: 1,
    name: "meeting",
    room: "Room 1",
  });
  lobby.destroy();
});

test("every physical activity has one unique stable scan tag", () => {
  assert.deepEqual(Object.keys(NFC_ACTIVITY_TAGS), NFC_ACTIVITIES);
  assert.equal(
    new Set(Object.values(NFC_ACTIVITY_TAGS)).size,
    NFC_ACTIVITIES.length
  );
});

test("preflight checks accept known QR and NFC tags only", () => {
  const host = makePlayer("green", { name: "undecided" });
  const lobby = makeLobby([host], { state: "inLobby", readyPlayers: {} });

  assert.equal(
    lobby.recordPreflightCheck(NFC_ACTIVITY_TAGS.wiretap1, "qr", host)[0],
    true
  );
  assert.equal(
    lobby.recordPreflightCheck("player:green", "nfc", host)[0],
    true
  );
  assert.equal(lobby.recordPreflightCheck("task:unknown", "qr", host)[0], false);
  assert.equal(
    lobby.recordPreflightCheck(NFC_ACTIVITY_TAGS.meeting, "camera", host)[0],
    false
  );

  const checks = lobby.serializeAdmin().preflightChecks;
  assert.equal(checks[NFC_ACTIVITY_TAGS.wiretap1].qr.playerColor, "green");
  assert.equal(checks["player:green"].nfc.playerName, host.name);
  assert.deepEqual(lobby.clearPreflightChecks(), [true]);
  assert.deepEqual(lobby.serializeAdmin().preflightChecks, {});
  lobby.destroy();
});

test("firewall sabotage requires an impostor and both matching terminals", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const yellow = makePlayer("yellow", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  const lobby = makeLobby([green, blue, yellow, red], {
    state: "started",
    countDown: 0,
  });

  assert.equal(lobby.launchSabotage("green", { kind: "firewallBreach" })[0], false);
  assert.deepEqual(lobby.launchSabotage("red", { kind: "firewallBreach" }), [true]);
  assert.ok(lobby.activeEffects.firewallBreach);

  assert.equal(green.startFirewallFix(0), true);
  assert.equal(green.finishFirewallFix(1), false);
  assert.deepEqual(green.currentlyDoing, { activity: "fixFirewall", number: 0 });
  assert.equal(green.finishFirewallFix(0), true);
  assert.deepEqual(lobby.pressFirewallButton(0), [true]);
  assert.equal(lobby.activeEffects.firewallBreach.buttonsPressed.firewallbutton1, true);

  assert.equal(blue.startFirewallFix(1), true);
  assert.equal(blue.finishFirewallFix(1), true);
  assert.deepEqual(lobby.pressFirewallButton(1), [true]);
  assert.equal(lobby.activeEffects.firewallBreach, null);
  lobby.destroy();
});

test("virus sabotage cannot overlap and movement locks tasks on the server", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const yellow = makePlayer("yellow", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  const lobby = makeLobby([green, blue, yellow, red], {
    state: "started",
    countDown: 0,
  });

  assert.equal(lobby.launchSabotage("red", null)[0], false);
  assert.deepEqual(lobby.launchSabotage("red", { kind: "virusScan" }), [true]);

  red.role.sabotageCooldown = 0;
  assert.equal(lobby.launchSabotage("red", { kind: "firewallBreach" })[0], false);
  assert.deepEqual(lobby.applyVirusPenalty("green"), [true]);
  assert.equal(green.isTaskLocked(), true);
  assert.equal(lobby.applyVirusPenalty("green")[0], false);

  green.tasks = [
    { name: "test", number: 0, description: "Тест", status: "available" },
  ];
  assert.equal(green.startTask(0), false);
  lobby.destroy();
});

test("a kill can be reported once and starts a body meeting", () => {
  const green = makePlayer("green", { name: "crew" });
  const blue = makePlayer("blue", { name: "crew" });
  const yellow = makePlayer("yellow", { name: "crew" });
  const red = makePlayer("red", {
    name: "impostor",
    killCooldown: 0,
    sabotageCooldown: 0,
  });
  const lobby = makeLobby([green, blue, yellow, red], {
    state: "started",
    countDown: 0,
  });

  assert.deepEqual(lobby.killPlayer("green", "red"), [true]);
  assert.equal(green.status, "dead");
  assert.deepEqual(lobby.reportDeadBody("blue", "green"), [true]);
  assert.equal(green.status, "foundDead");
  assert.equal(lobby.status.state, "meetingCalled");
  assert.equal(lobby.reportDeadBody("yellow", "green")[0], false);
  lobby.destroy();
});

test("the host can prepare and start an isolated fast test lobby", () => {
  const host = makePlayer("green", { name: "undecided" });
  const lobby = makeLobby([host], {
    state: "settingRooms",
    readyPlayers: {},
  });

  assert.deepEqual(lobby.adminPrepareTestLobby(3), [true]);
  assert.equal(lobby.testMode.enabled, true);
  assert.equal(lobby.status.state, "inLobby");
  assert.equal(Object.keys(lobby.players).length, 4);
  assert.equal(
    Object.values(lobby.players).filter((player) => player.isSimulated).length,
    3
  );
  assert.ok(lobby.activities.firewallbutton1);

  assert.deepEqual(lobby.adminStartTestGame(), [true]);
  assert.equal(lobby.status.state, "roleExplanation");
  assert.equal(lobby.status.countDown, TEST_MODE_TIMERS.roleDisplay);

  assert.deepEqual(lobby.adminAdvancePhase(), [true]);
  assert.equal(lobby.status.state, "started");
  assert.equal(lobby.status.countDown, TEST_MODE_TIMERS.meetingButton);

  const impostor = Object.values(lobby.players).find(
    (player) => player.role.name === "impostor"
  );
  assert.ok(impostor);
  assert.equal(impostor.role.killCooldown, TEST_MODE_TIMERS.killCooldown);
  assert.equal(impostor.role.sabotageCooldown, TEST_MODE_TIMERS.sabotageCooldown);

  assert.deepEqual(lobby.adminResetCooldowns(), [true]);
  assert.equal(impostor.role.killCooldown, 0);
  assert.deepEqual(lobby.adminLaunchSabotage("firewallBreach"), [true]);
  assert.equal(
    lobby.activeEffects.firewallBreach.countDown,
    TEST_MODE_TIMERS.firewall
  );
  assert.deepEqual(lobby.adminClearSabotage(), [true]);
  assert.equal(lobby.activeEffects.firewallBreach, null);
  lobby.destroy();
});

test("resetting a test match returns everyone alive and test bots stay removable", () => {
  const host = makePlayer("green", { name: "undecided" });
  const lobby = makeLobby([host], {
    state: "settingRooms",
    readyPlayers: {},
  });

  lobby.adminPrepareTestLobby(2);
  lobby.adminStartTestGame();
  lobby.adminAdvancePhase();
  const simulated = Object.values(lobby.players).find(
    (player) => player.isSimulated
  );
  simulated.status = "dead";

  assert.deepEqual(lobby.adminResetGame(), [true]);
  assert.equal(lobby.status.state, "inLobby");
  assert.ok(
    Object.values(lobby.players).every(
      (player) => player.status === "alive" && player.role.name === "undecided"
    )
  );
  assert.deepEqual(lobby.adminRemoveTestPlayers(), [true]);
  assert.equal(Object.keys(lobby.players).length, 1);
  assert.deepEqual(lobby.adminSetTestMode(false), [true]);
  assert.equal(lobby.testMode.enabled, false);
  lobby.destroy();
});

test("a host-only creator stays outside roles, readiness, meetings, and balance", () => {
  const host = makePlayer("green", { name: "undecided" });
  host.isHostOnly = true;
  const lobby = makeLobby([host], {
    state: "settingRooms",
    readyPlayers: {},
  });

  assert.deepEqual(lobby.adminPrepareTestLobby(3), [true]);
  assert.equal(Object.keys(lobby.players).length, 4);
  assert.equal(lobby.nParticipatingPlayers(), 3);
  assert.equal(lobby.status.readyPlayers[host.color], undefined);

  assert.deepEqual(lobby.adminStartTestGame(), [true]);
  assert.equal(host.role.name, "undecided");
  assert.deepEqual(host.tasks, []);
  assert.ok(
    lobby.participatingPlayers().every(
      (player) => player.role.name !== "undecided" && player.tasks.length > 0
    )
  );

  assert.deepEqual(lobby.adminSetPlayerStatus(host.color, "dead")[0], false);
  assert.deepEqual(lobby.adminSetPlayerRole(host.color, "crew")[0], false);

  assert.deepEqual(lobby.adminAdvancePhase(), [true]);
  const impostor = lobby
    .participatingPlayers()
    .find((player) => player.role.name === "impostor");
  assert.ok(impostor);
  impostor.role.killCooldown = 0;
  assert.equal(lobby.killPlayer(host.color, impostor.color)[0], false);

  assert.deepEqual(lobby.adminCallMeeting(), [true]);
  assert.deepEqual(lobby.adminAdvancePhase(), [true]);
  assert.equal(lobby.status.state, "meeting");
  assert.equal(lobby.status.nVoters, 3);
  assert.equal(lobby.status.votes[host.color], undefined);

  assert.deepEqual(lobby.adminResetGame(), [true]);
  assert.equal(lobby.status.readyPlayers[host.color], false);
  lobby.destroy();
});

test("a participating creator confirms readiness by starting the game", () => {
  const host = makePlayer("green", { name: "undecided" });
  const readyGuest = makePlayer("blue", { name: "undecided" });
  const waitingGuest = makePlayer("red", { name: "undecided" });
  const lobby = makeLobby([host, readyGuest, waitingGuest], {
    state: "inLobby",
    readyPlayers: { green: false, blue: true, red: false },
  });

  assert.equal(lobby.allParticipatingPlayersReadyExcept(host.color), false);
  lobby.status.readyPlayers[waitingGuest.color] = true;
  assert.equal(lobby.allParticipatingPlayersReadyExcept(host.color), true);
  assert.equal(lobby.allParticipatingPlayersReadyExcept(null), false);
  lobby.destroy();
});

test("role assignment avoids consecutive impostor streaks when alternatives exist", () => {
  const host = makePlayer("green", { name: "undecided" });
  const blue = makePlayer("blue", { name: "undecided" });
  const yellow = makePlayer("yellow", { name: "undecided" });
  const pink = makePlayer("pink", { name: "undecided" });
  const lobby = makeLobby([host, blue, yellow, pink], {
    state: "inLobby",
    readyPlayers: { green: true, blue: true, yellow: true, pink: true },
  });
  lobby.activities = Object.fromEntries(
    NFC_ACTIVITIES.map((name, index) => [
      name,
      { id: index + 1, name, room: `Room ${index + 1}` },
    ])
  );

  lobby.startGame();
  const firstImpostor = lobby
    .participatingPlayers()
    .find((player) => player.role.name === "impostor")?.color;
  assert.ok(firstImpostor);

  lobby.adminResetGame();
  lobby.startGame();
  const secondImpostor = lobby
    .participatingPlayers()
    .find((player) => player.role.name === "impostor")?.color;

  assert.ok(secondImpostor);
  assert.notEqual(secondImpostor, firstImpostor);
  assert.deepEqual(lobby.serializePersistence().lastImpostorColors, [
    secondImpostor,
  ]);
  lobby.destroy();
});

test("pausing a match blocks timed test actions and resumes without changing phase", () => {
  const host = makePlayer("green", { name: "undecided" });
  const lobby = makeLobby([host], {
    state: "settingRooms",
    readyPlayers: {},
  });

  lobby.adminPrepareTestLobby(2);
  lobby.adminStartTestGame();
  lobby.adminAdvancePhase();
  assert.equal(lobby.status.state, "started");

  assert.deepEqual(lobby.adminSetPaused(true), [true]);
  assert.equal(lobby.pause.active, true);
  assert.equal(lobby.adminAddTaskProgress()[0], false);
  assert.equal(lobby.adminCallMeeting()[0], false);
  assert.equal(lobby.adminLaunchSabotage("firewallBreach")[0], false);
  assert.equal(lobby.adminAdvancePhase()[0], false);

  const persisted = lobby.serializePersistence();
  assert.equal(persisted.pause.active, true);
  assert.ok(
    Object.values(persisted.players).every((player) => player.socketId == null)
  );

  assert.deepEqual(lobby.adminSetPaused(false), [true]);
  assert.equal(lobby.pause.active, false);
  assert.equal(lobby.status.state, "started");
  lobby.destroy();
});

test("the host can remove only disconnected non-creator players before start", () => {
  const host = makePlayer("green", { name: "undecided" });
  const guest = makePlayer("blue", { name: "undecided" });
  const lobby = makeLobby([host, guest], {
    state: "inLobby",
    readyPlayers: { green: true, blue: true },
  });

  assert.equal(lobby.adminRemoveDisconnectedPlayer("blue")[0], false);
  guest.connection = "disconnected";
  assert.deepEqual(lobby.adminRemoveDisconnectedPlayer("blue"), [true]);
  assert.equal(lobby.players.blue, undefined);
  assert.equal(lobby.status.readyPlayers.blue, undefined);

  host.connection = "disconnected";
  assert.equal(lobby.adminRemoveDisconnectedPlayer("green")[0], false);
  lobby.destroy();
});
