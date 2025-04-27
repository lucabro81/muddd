import fastify, { type FastifyInstance } from "fastify";
import path, { dirname } from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { type WorldType } from "core/common/types.js";
import { loadWorldStateFromFile } from "core/utils/world-loader.js";

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