// @ts-nocheck
export const MAX_PLAYERS = 15;

export const MEETING_TIME = 120;

export const VOTE_RESULT_DISPLAY_SECS = 10;

export const TASK_PROGRESSION_VICTORY_AMOUNT = 100;

export const ROLE_DISPLAY_SECS = 45;

// Update the progression bar only when this much progress has been made
// since the previous display update
export const TASK_PROGRESS_DISPLAY_THRESHOLD = 20;

export const PLAYER_COLORS = [
  "green",
  "blue",
  "yellow",
  "pink",
  "red",
  "orange",
  "purple",
  "black",
  "white",
  "cyan",
  "lime",
  "brown",
  "gray",
  "navy",
  "maroon",
];

// Position in the array is the id of the activity. The id is encoded on the NFC tag.
export const NFC_ACTIVITIES = [
  "meeting",
  "simonsays",
  "wiretap1",
  "wiretap2",
  "wiretap3",
  "passwordcrack",
  "bitcoinmine",
  "killthevirus",
  "firewallbutton1",
  "firewallbutton2",
  "sumtohundred",
  "destroyevidence",
  "packetrouting",
  "accesslog",
  "powergrid",
];

// Stable physical tag values. Keep these separate from activity names because
// several physical points may launch the same minigame (wiretap 1/2/3).
export const NFC_ACTIVITY_TAGS = Object.freeze({
  meeting: "meeting",
  simonsays: "task:simonsays",
  wiretap1: "task:wiretap1",
  wiretap2: "task:wiretap2",
  wiretap3: "task:wiretap3",
  passwordcrack: "task:passwordcrack",
  bitcoinmine: "task:bitcoinmine",
  killthevirus: "task:killthevirus",
  firewallbutton1: "firewall:0",
  firewallbutton2: "firewall:1",
  sumtohundred: "task:sumtohundred",
  destroyevidence: "task:destroyevidence",
  packetrouting: "task:packetrouting",
  accesslog: "task:accesslog",
  powergrid: "task:powergrid",
});

export const WIRETAP_CHECKPOINTS = Object.freeze([
  "wiretap1",
  "wiretap2",
  "wiretap3",
]);

export const BASE_LOCATIONS = Object.freeze([
  Object.freeze({ ru: "Контрольная точка", en: "Checkpoint" }),
  Object.freeze({ ru: "Сектор «Альфа»", en: "Alpha Sector" }),
  Object.freeze({ ru: "Сектор «Браво»", en: "Bravo Sector" }),
  Object.freeze({ ru: "Сектор «Чарли»", en: "Charlie Sector" }),
  Object.freeze({ ru: "Сектор «Дельта»", en: "Delta Sector" }),
  Object.freeze({ ru: "Узел связи", en: "Communications Hub" }),
  Object.freeze({ ru: "Аналитический центр", en: "Analysis Center" }),
  Object.freeze({ ru: "Технический блок", en: "Technical Bay" }),
  Object.freeze({ ru: "Зона брифинга", en: "Briefing Zone" }),
  Object.freeze({ ru: "Наблюдательный пост", en: "Observation Post" }),
]);

export function localizeLocationName(name, language = "ru") {
  if (typeof name !== "string") return "";
  const baseLocation = BASE_LOCATIONS.find(
    (location) => location.ru === name || location.en === name
  );
  return baseLocation?.[language === "en" ? "en" : "ru"] ?? name;
}

function localizedRoom(activities, activity, language) {
  return localizeLocationName(activities?.[activity]?.room, language);
}

export const TASKS = [
  {
    name: "simonsays",
    makeDescription: (activities) =>
      `Установите связь с тайным корреспондентом: ${localizedRoom(activities, "simonsays", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Contact the confidential source at: ${localizedRoom(activities, "simonsays", "en")}`,
  },
  {
    name: "wiretap",
    makeDescription: (activities) =>
      `Перехватите сигналы в точках: ${localizedRoom(activities, "wiretap1", "ru")}, ${localizedRoom(activities, "wiretap2", "ru")} и ${localizedRoom(activities, "wiretap3", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Intercept signals at: ${localizedRoom(activities, "wiretap1", "en")}, ${localizedRoom(activities, "wiretap2", "en")}, and ${localizedRoom(activities, "wiretap3", "en")}`,
  },
  {
    name: "passwordcrack",
    makeDescription: (activities) =>
      `Взломайте пароль: ${localizedRoom(activities, "passwordcrack", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Crack the password at: ${localizedRoom(activities, "passwordcrack", "en")}`,
  },
  {
    name: "bitcoinmine",
    makeDescription: (activities) =>
      `Откалибруйте хеш-реактор: ${localizedRoom(activities, "bitcoinmine", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Calibrate the hash reactor at: ${localizedRoom(activities, "bitcoinmine", "en")}`,
  },
  {
    name: "killthevirus",
    makeDescription: (activities) =>
      `Уничтожьте вирусы: ${localizedRoom(activities, "killthevirus", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Destroy the viruses at: ${localizedRoom(activities, "killthevirus", "en")}`,
  },
  {
    name: "sumtohundred",
    makeDescription: (activities) =>
      `Выполните вычисления: ${localizedRoom(activities, "sumtohundred", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Complete the calculations at: ${localizedRoom(activities, "sumtohundred", "en")}`,
  },
  {
    name: "destroyevidence",
    makeDescription: (activities) =>
      `Уничтожьте улики: ${localizedRoom(activities, "destroyevidence", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Destroy the evidence at: ${localizedRoom(activities, "destroyevidence", "en")}`,
  },
  {
    name: "packetrouting",
    makeDescription: (activities) =>
      `Восстановите маршрутизацию пакетов: ${localizedRoom(activities, "packetrouting", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Restore packet routing at: ${localizedRoom(activities, "packetrouting", "en")}`,
  },
  {
    name: "accesslog",
    makeDescription: (activities) =>
      `Проведите аудит журнала доступа: ${localizedRoom(activities, "accesslog", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Audit the access log at: ${localizedRoom(activities, "accesslog", "en")}`,
  },
  {
    name: "powergrid",
    makeDescription: (activities) =>
      `Стабилизируйте энергосеть: ${localizedRoom(activities, "powergrid", "ru")}`,
    makeDescriptionEn: (activities) =>
      `Stabilize the power grid at: ${localizedRoom(activities, "powergrid", "en")}`,
  },
];

// Number of minigames that are available in general
export const N_TOTAL_TASKS = TASKS.length;

// How many tasks do players get at a time
export const TASK_BATCH_SIZE = 3;

// For this amount of seconds after starting a new round, players cannot call emergency meetings
export const MEETING_BUTTON_CD = 20;

// How many emergency meetings a player may call per game
export const EMERGENCY_MEETINGS_PER_PLAYER = 1;

export const KILL_COOLDOWN_SECS = 55;

// A real player-to-player synchronization intentionally takes long enough for
// both people to stand together without revealing whether it is harmless.
export const PLAYER_SYNC_DURATION_MS = 15_000;
export const PLAYER_SYNC_REQUEST_TIMEOUT_MS = 30_000;

// The initial cooldown for a sabotage after a new round starts
export const SABO_COOLDOWN_SECS = 45;

export const HACKED_SECS = 12;
export const HACK_COOLDOWN = 15;

export const VIRUS_SCAN_FAILED_PUNISH_SECS = 25;
export const VIRUS_SCAN_COOLDOWN = 30;
export const VIRUS_SCAN_PREPARE_SECS = 5;
export const VIRUS_SCAN_TIME = 10;
export const VIRUS_SCAN_RESULT_GRACE_MS = 5_000;

export const FIREWALL_FIX_TIME = 120;
export const FIREWALL_COOLDOWN = 60;
export const FIREWALL_REPAIR_HOLD_MS = 10_000;

// Fast, explicit timings used only for lobbies where the host enabled test mode.
// Keeping them server-side prevents a browser from shortening a real match.
export const TEST_MODE_MIN_PLAYERS = 2;
export const TEST_MODE_TIMERS = Object.freeze({
  roleDisplay: 5,
  meeting: 25,
  voteResult: 4,
  meetingButton: 3,
  killCooldown: 8,
  sabotageCooldown: 5,
  firewall: 25,
  firewallRepairHoldMs: 2_000,
  playerSyncDurationMs: 3_000,
});

export const ACTIVE_EFFECTS_BASE = {
  hacked: null,
  firewallBreach: null,
};
