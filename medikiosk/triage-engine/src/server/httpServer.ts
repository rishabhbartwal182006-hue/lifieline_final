import { createServer, Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { Express } from "express";
import { createApp } from "./app.js";
import { registerSocketHandlers } from "../events/socketHandlers.js";
import { ALL_RULES } from "../rules/index.js";

export interface ServerInstance {
  app: Express;
  httpServer: HTTPServer;
  io: SocketIOServer;
  start: (port?: number) => Promise<number>;
  stop: () => Promise<void>;
}

export function createServerInstance(): ServerInstance {
  const app = createApp();
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    registerSocketHandlers(io, socket);
  });

  const start = (
    port: number = Number(process.env.PORT) || 4000,
  ): Promise<number> => {
    return new Promise((resolve) => {
      httpServer.listen(port, () => {
        console.log(`\n🏥 MediKiosk Triage Engine listening on port ${port}`);
        console.log(`📡 Socket.IO Real-Time Gateway active`);
        console.log(`🛡️  Active Clinical Rules Loaded: ${ALL_RULES.length}`);
        resolve(port);
      });
    });
  };

  const stop = (): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      try {
        io.close(() => {
          finish();
        });

        // Safety fallback in case Socket.IO does not invoke
        // its callback because there are no active connections.
        setTimeout(finish, 1000);
      } catch (error) {
        console.warn(
          "⚠️ Socket.IO shutdown warning:",
          error instanceof Error ? error.message : error,
        );

        finish();
      }
    });
  };

  return {
    app,
    httpServer,
    io,
    start,
    stop,
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  const server = createServerInstance();
  const PORT = Number(process.env.PORT) || 4000;
  server.start(PORT);
}
