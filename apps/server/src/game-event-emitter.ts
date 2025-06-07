import { server } from "./utils.js";
import { type WebSocket } from "@fastify/websocket";
import {
  type WorldType,
  gameEventEmitter,
  type GameEvent,
  applyEvent,
  EntityMoveEvent,
  LookTargetEvent,
  EntityId,
  generateRoomDescription,
  generateEntityDescriptionStream,
  OllamaProvider,
  getComponent,
  IsPresentInRoomComponent,
  LOCATION_COMPONENT_TYPE,
  InventoryComponent,
  INVENTORY_COMPONENT_TYPE,
  IsVisibleComponent,
  VISIBLE_COMPONENT_TYPE,
  PerceptionComponent,
  PERCEPTION_COMPONENT_TYPE,
  VisibilityLevel,
  DescriptionComponent,
  DESCRIPTION_COMPONENT_TYPE,
  EventType,
  LookRoomEvent,
  SearchCommandEvent
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

  gameEventEmitter.on<SearchCommandEvent>(EventType.SEARCH_COMMAND, async (event) => {
    const { actorId } = event;
    if (!worldState) return;

    // 1. Find the player's connection
    let clientData: { connection: WebSocket, playerId: EntityId, connectionId: string } | undefined;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    if (!clientData) {
      server.log.warn(`[SearchCommand] Could not find client connection for actor ${actorId}`);
      return;
    }

    // 2. Find the player's location and perception
    const location = getComponent<IsPresentInRoomComponent>(worldState, actorId, LOCATION_COMPONENT_TYPE);
    if (!location) {
      clientData.connection.send(JSON.stringify({ type: 'error', payload: "Non ti trovi in nessun luogo, impossibile cercare." }));
      return;
    }
    const roomId = location.roomId;
    const perception = getComponent<PerceptionComponent>(worldState, actorId, PERCEPTION_COMPONENT_TYPE);
    const sightLevel: VisibilityLevel = perception?.sightLevel ?? 0;

    // 3. Get all items in the room's inventory
    const roomInventory = getComponent<InventoryComponent>(worldState, roomId, INVENTORY_COMPONENT_TYPE);
    if (!roomInventory || roomInventory.items.length === 0) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Cerchi attentamente, ma non trovi nulla di nuovo." }));
      return;
    }

    // 4. Find "hidden" items (visibility level > 0) that the player can see
    const foundItems = roomInventory.items
      .map(itemId => {
        if (!worldState) return null; // Satisfy type checker
        const visibility = getComponent<IsVisibleComponent>(worldState, itemId, VISIBLE_COMPONENT_TYPE);
        const visibilityLevel: VisibilityLevel = visibility?.level ?? 0;
        return { itemId, visibilityLevel };
      })
      .filter((item): item is { itemId: EntityId; visibilityLevel: VisibilityLevel } =>
        item !== null && item.visibilityLevel > 0 && sightLevel >= item.visibilityLevel
      );

    if (foundItems.length > 0) {
      // Fire an event for each discovered item to update the player's state
      foundItems.forEach(item => {
        gameEventEmitter.emit(EventType.PLAYER_DISCOVERED_ITEM, {
          id: uuidv4(),
          type: EventType.PLAYER_DISCOVERED_ITEM,
          timestamp: Date.now(),
          actorId: actorId,
          itemId: item.itemId,
        });
      });

      const itemNames = foundItems
        .map(item => {
          if (!worldState) return null; // Satisfy type checker
          return getComponent<DescriptionComponent>(worldState, item.itemId, DESCRIPTION_COMPONENT_TYPE)?.name
        })
        .filter((name): name is string => !!name);

      const message = `Cerchi attentamente e trovi: ${itemNames.join(', ')}.`;
      clientData.connection.send(JSON.stringify({ type: 'text', payload: message }));
    } else {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Cerchi attentamente, ma non trovi nulla di nuovo." }));
    }
  });
}

export { setGameEventEmitter };