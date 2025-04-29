import { type WorldType } from 'core/main.js';
import { buildServer, loadingWorldState } from './utils.js';

// --- Configuration ---
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

// --- Server State ---
let worldState: WorldType | null = null;

async function startServer() {
  worldState = loadingWorldState();
  const server = await buildServer(worldState);
  server.log.info(`[server] World state loaded: ${worldState?.size} entities.`);
  try {
    await server.listen({ port: PORT, host: HOST });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  return server;
}

startServer();