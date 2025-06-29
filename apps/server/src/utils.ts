import fastifyWebsocket, { type WebSocket } from "@fastify/websocket";
import { EntityId, type WorldType, loadWorldStateFromFile } from "core/main.js";
import fastify, { type FastifyInstance } from "fastify";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { setGameEventEmitter } from "./game-event-emitter.js";
import { routes } from "./routes.js";
import { ClientConnection, ClientConnetionMap } from "./events-handlers/types.js";
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

export const server = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

const clientConnections = new Map<string, { connection: WebSocket, playerId: EntityId, connectionId: string }>();

export async function buildServer(worldState: WorldType | null): Promise<FastifyInstance> {
  if (!worldState) {
    throw new Error('World state is not loaded');
  }
  await server.register(fastifyWebsocket);
  setGameEventEmitter(worldState, clientConnections);
  routes(server, worldState, clientConnections);
  return server;
}

export function loadingWorldState(): WorldType | null {

  let worldState: WorldType | null = null;
  const worldJsonPath = path.resolve(__dirname, '../data/world.json');

  try {
    console.log(`Loading world state from: ${worldJsonPath}`);
    if (!fs.existsSync(worldJsonPath)) {
      throw new Error(`World JSON file not found at resolved path: ${worldJsonPath}. Current directory: ${process.cwd()}`);
    }
    worldState = loadWorldStateFromFile(worldJsonPath);
    console.log(`World state loaded. Entities: ${worldState?.size || 0}`);
  } catch (error) {
    console.error('FATAL ERROR: Could not load world state on startup.');
    console.error(error);
    process.exit(1);
  }
  return worldState;
}

export function connectionsClientData(actorId: EntityId) {
  return (clientConnections: ClientConnetionMap) => {
    let clientData: ClientConnection | undefined;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    return clientData;
  }
}