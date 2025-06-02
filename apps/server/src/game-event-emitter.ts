import { server } from "./utils.js";
import { type WebSocket } from "@fastify/websocket";
import {
  type WorldType,
  gameEventEmitter,
  type GameEvent,
  applyEvent,
  EventType,
  EntityMoveEvent,
  LookTargetEvent,
  LookRoomEvent,
  EntityId,
  generateRoomDescription,
  generateEntityDescriptionStream,
  OllamaProvider
} from "core/main.js"
import { v4 as uuidv4 } from 'uuid';

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
    let clientData: { connection: WebSocket, playerId: EntityId, connectionId: string } | undefined;
    for (const data of clientConnections.values()) {
      if (data.playerId === playerId) {
        clientData = data;
        break;
      }
    }

    if (clientData && worldState) { // Ensure the client is still connected and the state exists
      server.log.info(`Player ${playerId} moved to ${destinationRoomId}. Triggering LookRoomEvent.`);

      // Create and emit a LookRoomEvent
      const lookRoomEvent: LookRoomEvent = {
        id: uuidv4(),
        type: EventType.LOOK_ROOM,
        timestamp: Date.now(),
        actorId: playerId, // The player who moved is the actor looking
        roomId: destinationRoomId, // The room they moved to is the room to look at
      };
      gameEventEmitter.emit(EventType.LOOK_ROOM, lookRoomEvent);
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
        // Send the stream to the client as we did for the room description
        clientData.connection.send('\n'); // Separator
        for await (const chunk of descriptionStream) {
          if (clientConnections.has(clientData.connectionId)) { // Use the correct key here! e.g. clientData.clientId or req.id
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

  gameEventEmitter.on<LookRoomEvent>(EventType.LOOK_ROOM, async (event) => {
    const { actorId, roomId } = event;
    let clientData: { connection: WebSocket, playerId: EntityId, connectionId: string } | undefined;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }

    if (clientData && worldState) {
      server.log.info(`Player ${actorId} is looking at room ${roomId}. Generating description stream...`);
      try {
        const descriptionStream = await generateRoomDescription(
          llmProvider, worldState, roomId, actorId, llmModel
        );

        if (!clientConnections.has(clientData.connectionId)) {
          server.log.warn(`Client ${actorId} disconnected while streaming room description for ${roomId}.`);
          return;
        }

        clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));

        for await (const chunk of descriptionStream) {
          if (clientConnections.has(clientData.connectionId)) {
            clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: chunk }));
          } else {
            server.log.warn(`Client ${actorId} disconnected during room description stream for ${roomId}.`);
            break; // Stop streaming if client disconnects
          }
        }

        if (clientConnections.has(clientData.connectionId)) {
          clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));
        }
        server.log.info(`Finished streaming room description to ${actorId} for room ${roomId}.`);

      } catch (error) {
        server.log.error({ err: error, target: roomId, actor: actorId }, "Failed to generate or send room description");
        if (clientConnections.has(clientData.connectionId)) {
          clientData.connection.send(JSON.stringify({ type: 'error', payload: "\n[An error occurred while describing this place.]\n" }));
        }
      }
    }
  });
}

export { setGameEventEmitter };