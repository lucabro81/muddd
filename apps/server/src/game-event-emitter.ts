import { server } from "./utils.js";
import { type WebSocket } from "@fastify/websocket";
import { type WorldType, gameEventEmitter, type GameEvent, applyEvent, EventType, EntityMoveEvent, EntityId, generateRoomDescription, OllamaProvider } from "core/main.js"

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL
const llmModel = process.env.LLM_MODEL;

if (!ollamaBaseUrl || !llmModel) {
  throw new Error('OLLAMA_BASE_URL and LLM_MODEL must be set');
}

const llmProvider = new OllamaProvider(ollamaBaseUrl);

const setGameEventEmitter = (worldState: WorldType | null, clientConnections: Map<string, { connection: WebSocket, playerId: EntityId }>) => {
  gameEventEmitter.on('*', async (event: GameEvent) => {
    server.log.info(`[gameEventEmitter] Received event: ${event.type}`);
    if (!worldState || !event?.type) return;

    const stateBefore = worldState; // keep reference to the previous state
    let stateAfter: WorldType;

    try {
      stateAfter = applyEvent(worldState, event);
      worldState = stateAfter; // update the world state

      if (stateBefore !== stateAfter) {
        server.log.info(`World state updated after event ${event.type}. Entities: ${worldState.size}`);
      }

    } catch (error) {
      server.log.error({ err: error, event }, `Error applying event type ${event.type}`);

      return;
    }

    // If the event that just modified the state was a player movement...
    if (event.type === EventType.ENTITY_MOVE) {
      const moveEvent = event as EntityMoveEvent;
      const playerId = moveEvent.entityId;
      const destinationRoomId = moveEvent.destinationRoomId;

      // Find the websocket connection for this player
      // (We might need to iterate the values of clientConnections if the key is req.id)
      let clientData: { connection: WebSocket, playerId: EntityId } | undefined;
      for (const data of clientConnections.values()) {
        if (data.playerId === playerId) {
          clientData = data;
          break;
        }
      }

      if (clientData && worldState) { // Ensure the client is still connected and the state exists
        server.log.info(`Player ${playerId} moved to ${destinationRoomId}. Generating description...`);
        try {
          const description = await generateRoomDescription(
            llmProvider,
            worldState,
            destinationRoomId,
            playerId,
            llmModel
          );

          clientData.connection.send(`\n${description}\n`); // Add newline for readability

        } catch (descriptionError) {
          server.log.error({ err: descriptionError, roomId: destinationRoomId }, "Failed to generate or send room description");
          clientData.connection.send("\n[An error occurred while describing this place.]\n"); // Fallback message
        }
      }
    }
  });
}

export { setGameEventEmitter };