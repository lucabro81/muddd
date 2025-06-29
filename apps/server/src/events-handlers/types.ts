import { type WebSocket } from "@fastify/websocket";
import { EntityId } from "core/main.js";

export type ClientConnection = { connection: WebSocket, playerId: EntityId, connectionId: string };
export type ClientConnetionMap = Map<string, ClientConnection>;