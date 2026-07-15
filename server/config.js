import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadProjectEnv() {
  const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(serverDirectory, "../.env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] == null) process.env[key] = value;
  }
}

loadProjectEnv();

function readPositiveInteger(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBoolean(name, fallback = false) {
  const value = process.env[name];
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function readOrigins() {
  const configured = process.env.ALLOWED_ORIGINS;
  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === "development") {
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }

  return [];
}

export const config = Object.freeze({
  port: readPositiveInteger("PORT", 3000),
  minimumPlayers: readPositiveInteger("MIN_PLAYERS", 6),
  devMode: readBoolean("DEV_MODE"),
  adminSecret: process.env.ADMIN_SECRET || "",
  allowedOrigins: readOrigins(),
});
