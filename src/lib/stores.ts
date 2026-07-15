import { derived, writable, type Readable } from "svelte/store";
import type { Color, Lobby, Player } from "./types";
import { language, localizeServerMessage } from "./i18n";

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "replaced";

export const connectionStore = writable<ConnectionState>("connecting");

// All data of the entire lobby
export const lobbyStore = writable<Lobby | null>(null);

// Color of the current player
export const playerColorStore = writable<Color | null>(null);

// All data related to this player.
// Player store is derived from the lobbyStore by finding the
// player corresponding to our color in the lobby's `players` array
export const playerStore: Readable<Player | null> = derived(
  [lobbyStore, playerColorStore],
  ([lobby, color], set) => {
    if (lobby == null || color == null) set(null);
    else {
      const me = lobby.players[color];
      if (me == null)
        console.error(
          `Could not find own color (${color}) in the players array: ${JSON.stringify(
            lobby.players
          )}`
        );
      else set(me);
    }
  }
);

export const actionErrorStore = writable<string | null>(null);

export const notificationStore: Readable<string | null> = derived(
  [lobbyStore, actionErrorStore, language],
  ([lobby, actionError, currentLanguage]) => {
    if (actionError != null)
      return localizeServerMessage(actionError, currentLanguage);
    if (lobby == null) return null;
    if (
      lobby.activeEffects.firewallBreach != null &&
      lobby.status.state !== "gameEnded"
    )
      return currentLanguage === "en"
        ? `ALERT: firewall breached. Restore it at “${lobby.activities.firewallbutton1.room}” and “${lobby.activities.firewallbutton2.room}”. ${lobby.activeEffects.firewallBreach.countDown}s remaining.`
        : `ТРЕВОГА: защита взломана. Восстановите её в точках «${lobby.activities.firewallbutton1.room}» и «${lobby.activities.firewallbutton2.room}». Осталось ${lobby.activeEffects.firewallBreach.countDown} сек.`;
    return null;
  }
);

export const devNotiStore = writable(null as null | string);

export const showNotificationBar = writable(true);
