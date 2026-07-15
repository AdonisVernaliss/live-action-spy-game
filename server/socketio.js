import { Server } from "socket.io";
import http from "http";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const buildDirectory = path.resolve(serverDirectory, "../build");

export const app = express();
app.set("trust proxy", 1);

app.use(
  (req, res, next) => {
    if (req.url !== "/" && !req.url.includes(".")) {
      if (req.url.includes("?")) {
        const [url, query] = req.url.split("?");
        req.url = url + ".html?" + query;
      } else {
        req.url = req.url + ".html";
      }
    }

    next();
  },
  express.static(buildDirectory)
);

// cloudflared terminates public HTTPS; the local application only needs HTTP.
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});