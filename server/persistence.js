import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(serverDirectory, "../data");
const stateFile = path.join(dataDirectory, "lobbies.json");
const temporaryStateFile = `${stateFile}.tmp`;
const persistenceEnabled =
  process.env.NODE_ENV !== "test" && process.env.NODE_TEST_CONTEXT == null;

let pendingState = null;
let writeTimer = null;

export function readPersistedLobbyState() {
  if (!persistenceEnabled || !fs.existsSync(stateFile)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (parsed?.version !== 1 || !Array.isArray(parsed.lobbies)) {
      throw new Error("unsupported lobby state format");
    }
    return parsed.lobbies;
  } catch (error) {
    console.error(`Could not restore ${stateFile}:`, error);
    return [];
  }
}

export function scheduleLobbyStateWrite(lobbies) {
  if (!persistenceEnabled) return;
  pendingState = { version: 1, savedAt: new Date().toISOString(), lobbies };

  if (writeTimer != null) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flushLobbyStateWrite();
  }, 250);
  writeTimer.unref?.();
}

export function flushLobbyStateWrite(lobbies = null) {
  if (!persistenceEnabled) return;
  if (lobbies != null) {
    pendingState = { version: 1, savedAt: new Date().toISOString(), lobbies };
  }
  if (pendingState == null) return;

  if (writeTimer != null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  try {
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.writeFileSync(temporaryStateFile, JSON.stringify(pendingState, null, 2));
    fs.renameSync(temporaryStateFile, stateFile);
    pendingState = null;
  } catch (error) {
    console.error(`Could not save ${stateFile}:`, error);
  }
}

export function persistedLobbyStatePath() {
  return stateFile;
}
