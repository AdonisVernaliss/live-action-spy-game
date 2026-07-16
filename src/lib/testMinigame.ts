import { gotoReplace } from "$lib/util";

const TEST_MINIGAME_KEY = "protocol150TestMinigame";

export function startTestMinigame(gameId: number) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(
      TEST_MINIGAME_KEY,
      JSON.stringify({ gameId, startedAt: Date.now() })
    );
  }
  gotoReplace(`/minigame/${gameId}`);
}

export function isTestMinigameActive() {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const stored = JSON.parse(sessionStorage.getItem(TEST_MINIGAME_KEY) || "null");
    return (
      Number.isInteger(stored?.gameId) &&
      Date.now() - Number(stored?.startedAt) < 2 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}

export function clearTestMinigame() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(TEST_MINIGAME_KEY);
  }
}

export function returnFromTestMinigame() {
  clearTestMinigame();
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("currentTaskNumber");
    localStorage.removeItem("currentTaskTag");
  }
  gotoReplace("/admin");
}
