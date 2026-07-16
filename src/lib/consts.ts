export {
  TASKS,
  N_TOTAL_TASKS,
  NFC_ACTIVITIES,
  NFC_ACTIVITY_TAGS,
  BASE_LOCATIONS,
  localizeLocationName,
  TEST_MODE_MIN_PLAYERS,
  VIRUS_SCAN_PREPARE_SECS,
  VIRUS_SCAN_TIME,
} from "../../server/consts";
import { env } from "$env/dynamic/public";

const configuredMinimumPlayers = Number.parseInt(env.PUBLIC_MIN_PLAYERS || "6", 10);
export const MINIMUM_N_PLAYERS = Number.isFinite(configuredMinimumPlayers)
  ? Math.max(1, configuredMinimumPlayers)
  : 6;

// N.B. not all of these are actually used.
// Look at backend to find out which colors are used.
export const COLORS = {
  green: "bg-green-600",
  blue: "bg-blue-600",
  yellow: "bg-yellow-400",
  pink: "bg-pink-400",
  red: "bg-red-600",

  orange: "bg-orange-600",
  purple: "bg-purple-700",
  black: "bg-black border border-white/50",
  white: "bg-white border border-gray-400",
  cyan: "bg-cyan-400",
  lime: "bg-lime-400",
  brown: "bg-yellow-900",
  gray: "bg-gray-500",
  navy: "bg-blue-950",
  maroon: "bg-red-950",
} as { [key: string]: string };

// Pressing ctrl and this key will open/close the dev panel
export const DEV_PANEL_KEY = ".";

export const VIRUS_FAIL_TIME = 25;

export const dev = env.PUBLIC_DEV_MODE === "true" || env.PUBLIC_DEV_MODE === "1";
