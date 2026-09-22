import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { Express } from "express";
export interface ServerInstance {
    app: Express;
    httpServer: HTTPServer;
    io: SocketIOServer;
    start: (port?: number) => Promise<number>;
    stop: () => Promise<void>;
}
export declare function createServerInstance(): ServerInstance;
