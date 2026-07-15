import { nanoid } from "nanoid";
import {
  EMERGENCY_MEETINGS_PER_PLAYER,
  N_TOTAL_TASKS,
  PLAYER_COLORS,
  TASKS,
  TASK_BATCH_SIZE,
} from "./consts.js";
import { randInt } from "./util.js";

export class Player {
  constructor({ name, connection, status, color, isHostOnly = false }) {
    this.name = name;
    this.connection = connection;
    this.isSimulated = connection === "simulated";
    this.isHostOnly = isHostOnly === true;
    this.status = status;

    this.role = { name: "undecided" };
    this.tasks = [];

    this.color = color || randomPlayerColor();

    // Current active Socket.IO connection id.
    // Used to ignore stale disconnects from older sockets after reconnect.
    this.socketId = null;

    this.currentlyDoing = { activity: "nothing" };
    this.taskLockedUntil = 0;
    this.syncTask = {
      required: !this.isHostOnly,
      completed: false,
      partnerColor: null,
      completedAt: null,
    };
    this.emergencyMeetingsLeft = EMERGENCY_MEETINGS_PER_PLAYER;
    this.id = nanoid();
  }

  assignTasks(activities) {
    const pastTasks = new Set(this.tasks.map((t) => t.number));

    const availableTasks = Array.from(Array(N_TOTAL_TASKS).keys())
      .map((idx) => (pastTasks.has(idx) ? null : idx))
      .filter((t) => t !== null);

    const newTasks = new Set();

    while (newTasks.size < TASK_BATCH_SIZE) {
      if (
        availableTasks.length < TASK_BATCH_SIZE &&
        newTasks.size === availableTasks.length
      ) {
        const taskNr = randInt(0, pastTasks.size - 1);
        const task = Array.from(pastTasks.values())[taskNr];
        newTasks.add(task);
      } else {
        const task = randInt(0, availableTasks.length - 1);
        newTasks.add(task);
      }
    }

    this.tasks = [];

    for (const taskNumber of newTasks.values()) {
      const taskName = TASKS[taskNumber].name;

      this.tasks.push({
        name: taskName,
        number: taskNumber,
        description: TASKS[taskNumber].makeDescription(activities),
        descriptionEn: TASKS[taskNumber].makeDescriptionEn(activities),
        status: "available",
      });
    }
  }

  startTask(taskNumber) {
    if (this.isTaskLocked()) return false;

    const task = this.tasks.find((task) => task.number === taskNumber);

    if (task == null || task.status !== "available") return false;

    // If the player is already inside a task, allow switching/restarting.
    // This prevents players getting stuck after refresh, scan page redirect, or old stale task state.
    if (
      this.currentlyDoing.activity !== "nothing" &&
      this.currentlyDoing.activity !== "task"
    ) {
      return false;
    }

    this.currentlyDoing = {
      activity: "task",
      number: taskNumber,
    };

    return true;
  }

  finishTask(taskNumber) {
    if (
      this.currentlyDoing.activity !== "task" &&
      this.role.name !== "impostor"
    ) {
      return false;
    }

    if (
      this.currentlyDoing.number !== taskNumber &&
      this.role.name !== "impostor"
    ) {
      return false;
    }

    const task = this.tasks.find((task) => task.number === taskNumber);

    if (task == null) return false;

    if (task.status === "completed") {
      this.currentlyDoing = { activity: "nothing" };
      return false;
    }

    task.status = "completed";
    this.currentlyDoing = { activity: "nothing" };

    return true;
  }

  hasCompletedAllRegularTasks() {
    const regularTasks = this.tasks.filter((task) => task.isExtraTask !== true);

    return (
      regularTasks.length > 0 &&
      regularTasks.every((task) => task.status === "completed")
    );
  }

  assignSecretExtraTask() {
    const alreadyHasExtraTask = this.tasks.some(
      (task) => task.isExtraTask === true
    );

    if (alreadyHasExtraTask) return false;

    this.tasks.push({
      name: "secretlongtask",
      number: 1000,
      description:
        "Секретное дополнительное задание: длительное переопределение системы.",
      descriptionEn:
        "Secret extra task: complete a prolonged system override.",
      status: "available",
      isExtraTask: true,
      optional: true,
    });

    return true;
  }

  startFirewallFix(number) {
    if (this.currentlyDoing.activity !== "nothing") return false;
    if (number !== 0 && number !== 1) return false;

    this.currentlyDoing = {
      activity: "fixFirewall",
      number,
    };

    return true;
  }

  finishFirewallFix(number) {
    if (this.currentlyDoing.activity !== "fixFirewall") return false;
    if (this.currentlyDoing.number !== number) return false;

    this.currentlyDoing = {
      activity: "nothing",
    };

    return true;
  }

  lockTasks(seconds) {
    const durationMs = Math.max(0, Number(seconds) || 0) * 1000;
    this.taskLockedUntil = Math.max(this.taskLockedUntil, Date.now() + durationMs);
  }

  isTaskLocked() {
    return this.taskLockedUntil > Date.now();
  }

  resetSyncTask(required = true) {
    this.syncTask = {
      required: required === true,
      completed: required !== true,
      partnerColor: null,
      completedAt: null,
    };
  }

  completeSyncTask(partnerColor) {
    this.syncTask = {
      required: true,
      completed: true,
      partnerColor,
      completedAt: Date.now(),
    };
  }
}

export function randomPlayerColor() {
  const random = randInt(0, PLAYER_COLORS.length - 1);
  return PLAYER_COLORS[random];
}

export function playerNameValid(name) {
  if (typeof name !== "string") return [false, "Введите ник."];
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) {
    return [false, "Ник слишком короткий. Минимум 2 символа."];
  }

  if (normalized.length > 20) {
    return [false, "Ник слишком длинный. Максимум 20 символов."];
  }

  if (!/^[\p{L}\p{N}_ -]+$/u.test(normalized)) {
    return [
      false,
      "Используйте русские или латинские буквы, цифры, пробел, дефис и подчёркивание.",
    ];
  }

  return [true];
}
