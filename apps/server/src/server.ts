import { fastifyWebsocket } from '@fastify/websocket';
import { server, loadingWorldState } from './utils.js';
import { type WorldType } from 'core/common/types.js';
import { routes } from './routes.js';
// --- Configuration ---
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

// --- Server State ---
let worldState: WorldType | null = null;

// --- Startup and Initialization Function ---
async function startServer() {
  console.log('Initializing MUD server...');

  worldState = loadingWorldState();

  server.register(fastifyWebsocket);

  routes(server, worldState);

  // TODO: Register WebSocket handler for client connections

  // 4. Start the Server
  try {
    await server.listen({ port: PORT, host: HOST });
    // The Fastify logger should show the address on which it is listening
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  return server; // Potrebbe essere utile restituire l'istanza del server
}

// --- Esegui l'avvio ---
startServer();