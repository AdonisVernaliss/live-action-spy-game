import * as socketIO from "socket.io-client";
import type { GameAction, GameActionResult } from "./types";
import { env } from "$env/dynamic/public";
import { actionErrorStore, connectionStore } from "./stores";

let socket: socketIO.Socket | null = null;

export function getSocketIO(): socketIO.Socket {
  if (socket == null) {
    const SERVER =
      env.PUBLIC_SERVER ||
      (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : window.location.origin);
    socket = socketIO
      .connect(SERVER)
      .on("connect", () => {
        connectionStore.set("connected");
      })
      .on("disconnect", () => {
        connectionStore.set(navigator.onLine ? "reconnecting" : "offline");
      })
      .on("connect_error", () => {
        connectionStore.set(navigator.onLine ? "reconnecting" : "offline");
      })
      .on("sessionReplaced", () => {
        connectionStore.set("replaced");
      });
  }
  return socket;
}

let errorTimer: ReturnType<typeof setTimeout> | null = null;

export function emitGameAction(action: GameAction): Promise<GameActionResult> {
  const activeSocket = getSocketIO();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const result: GameActionResult = {
        success: false,
        action: action.action,
        code: "ACTION_TIMEOUT",
        message: "Сервер не подтвердил действие. Проверьте соединение и попробуйте снова.",
      };
      showActionError(result.message);
      resolve(result);
    }, 5000);

    activeSocket.emit("gameAction", action, (result: GameActionResult) => {
      clearTimeout(timeout);
      if (!result.success) showActionError(result.message);
      resolve(result);
    });
  });
}

function showActionError(message: string) {
  actionErrorStore.set(message);
  if (errorTimer != null) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => actionErrorStore.set(null), 6000);
}
