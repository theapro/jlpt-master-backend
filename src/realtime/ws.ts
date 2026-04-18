import type http from "http";
import type { IncomingMessage } from "http";

import { WebSocket, WebSocketServer } from "ws";

import { verifyAdminToken } from "../modules/auth/auth.service";

type AdminClient = {
  adminId: number;
  role: string;
};

let wss: WebSocketServer | null = null;
const clients = new Map<WebSocket, AdminClient>();

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const getTokenFromRequest = (req: IncomingMessage) => {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token");
    if (token && token.trim().length > 0) return token.trim();
  } catch {
    // ignore
  }

  return null;
};

export const realtimeWs = {
  init: (server: http.Server) => {
    if (wss) return;

    wss = new WebSocketServer({ server, path: "/ws" });

    wss.on("connection", (socket, req) => {
      const token = getTokenFromRequest(req);
      if (!token) {
        socket.close(1008, "Unauthorized");
        return;
      }

      try {
        const payload = verifyAdminToken(token);
        clients.set(socket, { adminId: payload.adminId, role: payload.role });
      } catch {
        socket.close(1008, "Unauthorized");
        return;
      }

      socket.on("close", () => {
        clients.delete(socket);
      });

      socket.on("error", () => {
        clients.delete(socket);
      });
    });

    wss.on("error", (err) => {
      console.error("[ERROR SOURCE]: realtime.ws");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    });
  },

  broadcast: (payload: unknown) => {
    if (!wss || clients.size === 0) return;

    const data = safeJsonStringify(payload);
    if (!data) return;

    for (const socket of clients.keys()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      try {
        socket.send(data);
      } catch {
        // ignore
      }
    }
  },

  emitMessageCreated: (message: unknown) => {
    realtimeWs.broadcast({ type: "message.created", message });
  },
};
