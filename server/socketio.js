import { Server } from "socket.io";
import http from "http";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const buildDirectory = path.resolve(serverDirectory, "../build");

export const app = express();
app.set("trust proxy", 1);

app.use(
  (req, res, next) => {
    const [rawPathname, ...queryParts] = req.url.split("?");
    const pathname =
      rawPathname.length > 1 && rawPathname.endsWith("/")
        ? rawPathname.slice(0, -1)
        : rawPathname;

    if (pathname !== "/" && !pathname.includes(".")) {
      const query = queryParts.length > 0 ? `?${queryParts.join("?")}` : "";
      req.url = `${pathname}.html${query}`;
    }

    next();
  },
  express.static(buildDirectory)
);

// cloudflared terminates public HTTPS; the local application only needs HTTP.
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    // Same-origin production needs no CORS headers. Split development is
    // allowed only for the explicitly configured frontend origins.
    origin:
      config.allowedOrigins.length > 0 ? config.allowedOrigins : false,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});
