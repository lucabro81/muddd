import fastify from 'fastify';
import * as path from 'path';
import { loadWorldStateFromFile } from 'core/world-loader';
import { WorldType } from 'core/types';
import * as fs from 'fs';

// --- Configuration ---
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

const worldJsonPath = path.resolve(__dirname, '../data/world.json');

// --- Server State ---
let worldState: WorldType | null = null;

// --- Startup and Initialization Function ---
async function startServer() {
  console.log('Initializing MUD server...');

  // 1. Load Initial World State
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

  // 2. Create Fastify Instance
  const server = fastify({
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

  // 3. Register Routes (Example Status)
  server.get('/status', async (_request, reply) => {
    return reply.send({
      status: 'running',
      worldEntitiesLoaded: worldState?.size ?? 0,
      timestamp: new Date().toISOString(),
    });
  });

  // TODO: Register WebSocket handler for client connections

  // 4. Start the Server
  try {
    await server.listen({ port: PORT, host: HOST });
    // The Fastify logger should show the address on which it is listening
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  return server;
}

// --- Execute the startup ---
startServer();