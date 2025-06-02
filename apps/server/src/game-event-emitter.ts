import { server } from "./utils.js";
import { type WebSocket } from "@fastify/websocket";
import { type WorldType, gameEventEmitter, type GameEvent, applyEvent, EventType, EntityMoveEvent, LookTargetEvent, EntityId, generateRoomDescription, generateEntityDescriptionStream, OllamaProvider } from "core/main.js"

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL
const llmModel = process.env.OLLAMA_MODEL;

if (!ollamaBaseUrl || !llmModel) {
  throw new Error('OLLAMA_BASE_URL and OLLAMA_MODEL must be set');
}

const llmProvider = new OllamaProvider(ollamaBaseUrl);

const setGameEventEmitter = (worldState: WorldType | null, clientConnections: Map<string, { connection: WebSocket, playerId: EntityId, connectionId: string }>) => {
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
  });

  gameEventEmitter.on<EntityMoveEvent>(EventType.ENTITY_MOVE, async (event: EntityMoveEvent) => {
    const playerId = event.entityId;
    const destinationRoomId = event.destinationRoomId;

    // Find the websocket connection for this player
    // (We might need to iterate the values of clientConnections if the key is req.id)
    let clientData: { connection: WebSocket, playerId: EntityId, connectionId: string } | undefined;
    for (const data of clientConnections.values()) {
      if (data.playerId === playerId) {
        clientData = data;
        break;
      }
    }

    // TBD: is worldState check needed?
    if (clientData && worldState) { // Ensure the client is still connected and the state exists
      server.log.info(`Player ${playerId} moved to ${destinationRoomId}. Generating description...`);
      try {
        // 1. Get the async iterable from the engine
        const descriptionStream = await generateRoomDescription(
          llmProvider,
          worldState,
          destinationRoomId,
          playerId,
          llmModel
        );

        if (!clientConnections.has(clientData.connectionId)) {
          server.log.warn(`Client ${playerId} disconnected while streaming description.`);
          return;
        }

        // Send an initial newline for visual separation in the client
        clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));

        // 2. Iterate on the stream and send the chunks to the client
        for await (const chunk of descriptionStream) {
          clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: chunk }));
        }

        // Add a final newline for separation from the next input/output
        clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));

        server.log.info(`Finished streaming description to ${playerId}.`);

      } catch (descriptionError) {
        server.log.error({ err: descriptionError, roomId: destinationRoomId }, "Failed to generate or send room description");
        clientData.connection.send("\n[An error occurred while describing this place.]\n"); // Fallback message
      }
    }
  });

  gameEventEmitter.on<LookTargetEvent>(EventType.LOOK_TARGET, async (event) => {
    const { actorId, targetEntityId } = event;
    let clientData: { connection: WebSocket, playerId: EntityId, connectionId: string } | undefined;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    if (clientData && worldState) {
      server.log.info(`Player ${actorId} is looking at ${targetEntityId}. Generating description stream...`);
      try {
        const descriptionStream = await generateEntityDescriptionStream(
          llmProvider, worldState, targetEntityId, actorId, llmModel
        );
        // Invia lo stream al client come abbiamo fatto per la descrizione della stanza
        clientData.connection.send('\n'); // Separatore
        for await (const chunk of descriptionStream) {
          if (clientConnections.has(clientData.connectionId)) { // Usa la chiave corretta qui! es: clientData.clientId o req.id
            clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: chunk }));
          } else { break; }
        }
        if (clientConnections.has(clientData.connectionId)) {
          clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));
        }
        server.log.info(`Finished streaming entity description to ${actorId}.`);
      } catch (error) {
        server.log.error({ err: error, target: targetEntityId }, "Failed to generate or send entity description");
        if (clientConnections.has(clientData.connectionId)) {
          clientData.connection.send(JSON.stringify({ type: 'error', payload: "\n[Errore nella descrizione dell'oggetto.]\n" }));
        }
      }
    }
  });
}

export { setGameEventEmitter };