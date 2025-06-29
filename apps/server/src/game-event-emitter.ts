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
  SearchCommandEvent,
  PickupCommandEvent,
  KnownHiddenItemsComponent,
  KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE,
  IsPickupableComponent,
  PICKUPABLE_COMPONENT_TYPE,
  InventoryCommandEvent,
  PutCommandEvent,
  SocketComponent,
  SOCKET_COMPONENT_TYPE,
  ExamineCommandEvent,
  findTargetEntity,
  UseCommandEvent,
  CommandFailedEvent,
  CommandFailureReason,
  DropCommandEvent,
  ItemDroppedEvent,
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

        const inventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
        const isInInventory = inventory && inventory.items.includes(targetEntityId)

        const descriptionStream = await generateEntityDescriptionStream(
          llmProvider, worldState, targetEntityId, actorId, llmModel
        );
        // Send the stream to the client as we did for the room description
        clientData.connection.send('\n'); // Separator
        let isInInventoryAdded = false;
        for await (const chunk of descriptionStream) {
          if (isInInventory && !isInInventoryAdded) {
            clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: '[Inventario]\n' }));
            isInInventoryAdded = true;
          }
          if (clientConnections.has(clientData.connectionId)) { // Use the correct key here! e.g. clientData.clientId or req.id
            clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: `${chunk}` }));
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
    server.log.info(`[SearchCommand] Received event: ${event.type}`);

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
    server.log.info(`[SearchCommand] Perception: ${JSON.stringify(perception)}`);
    const sightLevel: VisibilityLevel = perception?.sightLevel ?? 0;
    const searchModifier = perception?.searchModifier ?? 0;
    const effectiveSearchLevel = sightLevel + searchModifier;
    server.log.info(`[SearchCommand] Sight level: ${sightLevel}, Search Modifier: ${searchModifier}, Effective Level: ${effectiveSearchLevel}`);

    // 3. Get all items in the room's inventory
    const roomInventory = getComponent<InventoryComponent>(worldState, roomId, INVENTORY_COMPONENT_TYPE);
    server.log.info(`[SearchCommand] Room inventory: ${JSON.stringify(roomInventory)}`);
    if (!roomInventory || roomInventory.items.length === 0) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Cerchi attentamente, ma non trovi nulla di nuovo." }));
      return;
    }

    server.log.info(`[SearchCommand] Effective search level: ${effectiveSearchLevel}`);

    // 4. Find "hidden" items (visibility level >= 0) that the player can see depending on their sight level
    const foundItems = roomInventory.items
      .map(itemId => {
        if (!worldState) return null; // Satisfy type checker
        const visibility = getComponent<IsVisibleComponent>(worldState, itemId, VISIBLE_COMPONENT_TYPE);
        server.log.info(`[SearchCommand] Visibility: ${JSON.stringify(visibility)} for item ${itemId}`);
        const visibilityLevel: VisibilityLevel = visibility?.level ?? 0;
        server.log.info(`[SearchCommand] Visibility level: ${visibilityLevel}`);
        return { itemId, visibilityLevel };
      })
      .filter((item): item is { itemId: EntityId; visibilityLevel: VisibilityLevel } => {
        server.log.info(`[SearchCommand] Item: ${JSON.stringify(item)}`);
        server.log.info(`[SearchCommand] Item visibility level: ${item?.visibilityLevel}`);
        return item !== null && item.visibilityLevel >= 0 && effectiveSearchLevel >= item.visibilityLevel;
      });

    server.log.info(`[SearchCommand] Found items: ${JSON.stringify(foundItems)}`);

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

      const message = `Cerchi attentamente e trovi: \n\t - ${itemNames.join('\n\t - ')}.`;
      clientData.connection.send(JSON.stringify({ type: 'text', payload: message }));
    } else {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Cerchi attentamente, ma non trovi nulla di nuovo." }));
    }
  });

  gameEventEmitter.on<PickupCommandEvent>(EventType.PICKUP_COMMAND, async (event) => {
    const { actorId, targetKeywords } = event;
    console.log(`[PickupCommand] Received for actor ${actorId} with keywords "${targetKeywords}"`);
    server.log.info(`[PickupCommand] Received for actor ${actorId} with keywords "${targetKeywords}"`);

    if (!worldState) return;

    // 1. Find player's connection
    let clientData;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }

    if (!clientData) {
      server.log.warn(`[PickupCommand] Could not find client for actor ${actorId}`);
      return;
    }

    // 2. Find player's location and perception to determine what they can see
    const location = getComponent<IsPresentInRoomComponent>(worldState, actorId, LOCATION_COMPONENT_TYPE);
    if (!location) {
      // This should not happen for a player, but as a safeguard:
      clientData.connection.send(JSON.stringify({ type: 'error', payload: "Non ti trovi in nessun luogo." }));
      return;
    }
    const roomInventory = getComponent<InventoryComponent>(worldState, location.roomId, INVENTORY_COMPONENT_TYPE);
    if (!roomInventory || roomInventory.items.length === 0) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Non vedi nulla da raccogliere qui." }));
      return;
    }

    // // 3. Find the target item in the room
    const targetItemId = findTargetEntity(worldState, roomInventory.items, targetKeywords);
    if (!targetItemId || targetItemId === 'ambiguous') {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non trovi nessun oggetto che corrisponda a "${targetKeywords}".` }));
      return;
    }

    // 4. Validate and fire state-changing event
    const perception = getComponent<PerceptionComponent>(worldState, actorId, PERCEPTION_COMPONENT_TYPE);
    const knownHiddenItems = getComponent<KnownHiddenItemsComponent>(worldState, actorId, KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE);
    const sightLevel = perception?.sightLevel ?? 0;
    const knownItemIds = knownHiddenItems?.itemIds ?? [];
    const visibility = getComponent<IsVisibleComponent>(worldState, targetItemId, VISIBLE_COMPONENT_TYPE);
    const isVisible = (visibility?.level ?? 0) <= sightLevel || knownItemIds.includes(targetItemId);
    if (!isVisible) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non riesci a vedere nessun oggetto che corrisponda a "${targetKeywords}".` }));
      return;
    }

    const isPickupable = getComponent<IsPickupableComponent>(worldState, targetItemId, PICKUPABLE_COMPONENT_TYPE);
    if (!isPickupable) {
      const targetDescription = getComponent<DescriptionComponent>(worldState, targetItemId, DESCRIPTION_COMPONENT_TYPE);
      const targetName = targetDescription?.name ?? "quell'oggetto";
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non puoi raccogliere ${targetName}.` }));
      return;
    }

    // All checks passed, fire the event to change the state
    gameEventEmitter.emit(EventType.ITEM_PICKED_UP, {
      id: uuidv4(),
      type: EventType.ITEM_PICKED_UP,
      timestamp: Date.now(),
      actorId: actorId,
      itemId: targetItemId,
    });

    const targetDescription = getComponent<DescriptionComponent>(worldState, targetItemId, DESCRIPTION_COMPONENT_TYPE);
    const targetName = targetDescription?.name ?? "l'oggetto";
    clientData.connection.send(JSON.stringify({ type: 'text', payload: `Raccogli: ${targetName}.` }));
  });

  gameEventEmitter.on<InventoryCommandEvent>(EventType.INVENTORY_COMMAND, async (event) => {
    const { actorId } = event;
    server.log.info(`[InventoryCommand] Received for actor ${actorId}`);

    if (!worldState) return;

    // 1. Find player's connection
    let clientData;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    if (!clientData) {
      server.log.warn(`[InventoryCommand] Could not find client for actor ${actorId}`);
      return;
    }

    // 2. Get player's inventory
    const inventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
    if (!inventory || inventory.items.length === 0) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Non hai nulla con te." }));
      return;
    }

    // 3. Format the list of items
    const itemNames = inventory.items.map(itemId => {
      if (!worldState) return "un oggetto non identificabile"; // Should not happen, but satisfies TS
      const description = getComponent<DescriptionComponent>(worldState, itemId, DESCRIPTION_COMPONENT_TYPE);
      return description?.name ?? "un oggetto senza nome";
    });

    const message = `Hai con te:\n - ${itemNames.join('\n - ')}`;
    clientData.connection.send(JSON.stringify({ type: 'text', payload: message }));
  });

  gameEventEmitter.on<PutCommandEvent>(EventType.PUT_COMMAND, async (event) => {
    const { actorId, itemKeywords, targetKeywords } = event;
    server.log.info(`[PutCommand] Received for actor ${actorId}: item "${itemKeywords}", target "${targetKeywords}"`);

    if (!worldState) return;

    // 1. Find player's connection
    let clientData;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    if (!clientData) {
      server.log.warn(`[PutCommand] Could not find client for actor ${actorId}`);
      return;
    }

    // 2. Resolve the item from the player's inventory
    const playerInventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
    if (!playerInventory || playerInventory.items.length === 0) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non hai un "${itemKeywords}".` }));
      return;
    }

    const itemSearchTerms = itemKeywords.toLowerCase().split(' ').filter(t => t);
    let itemIdToPlace: EntityId | null = null;
    for (const itemId of playerInventory.items) {
      const description = getComponent<DescriptionComponent>(worldState, itemId, DESCRIPTION_COMPONENT_TYPE);
      if (description) {
        const entityKeywords = description.keywords.map(k => k.toLowerCase());
        const isMatch = itemSearchTerms.every(term => entityKeywords.some(keyword => keyword.includes(term)));
        if (isMatch) {
          itemIdToPlace = itemId;
          break;
        }
      }
    }

    if (!itemIdToPlace) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non hai un "${itemKeywords}".` }));
      return;
    }

    // 3. Resolve the target from the player's current room
    const location = getComponent<IsPresentInRoomComponent>(worldState, actorId, LOCATION_COMPONENT_TYPE);
    if (!location) {
      clientData.connection.send(JSON.stringify({ type: 'error', payload: "Non ti trovi in nessun luogo." }));
      return;
    }
    const roomInventory = getComponent<InventoryComponent>(worldState, location.roomId, INVENTORY_COMPONENT_TYPE);
    if (!roomInventory) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non vedi un "${targetKeywords}" qui.` }));
      return;
    }

    const targetSearchTerms = targetKeywords.toLowerCase().split(' ').filter(t => t);
    let targetId: EntityId | null = null;
    for (const entityId of roomInventory.items) {
      const description = getComponent<DescriptionComponent>(worldState, entityId, DESCRIPTION_COMPONENT_TYPE);
      if (description) {
        const entityKeywords = description.keywords.map(k => k.toLowerCase());
        const isMatch = targetSearchTerms.every(term => entityKeywords.some(keyword => keyword.includes(term)));
        if (isMatch) {
          targetId = entityId;
          break;
        }
      }
    }

    if (!targetId) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non vedi un "${targetKeywords}" qui.` }));
      return;
    }

    // 4. Validate the interaction
    const socket = getComponent<SocketComponent>(worldState, targetId, SOCKET_COMPONENT_TYPE);
    if (!socket) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Non puoi metterci niente dentro." }));
      return;
    }
    if (socket.isOccupied) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "È già pieno." }));
      return;
    }
    if (socket.acceptsItemId !== itemIdToPlace) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "Non sembra entrare." }));
      return;
    }

    // 5. Fire the state-changing event
    gameEventEmitter.emit(EventType.ITEM_PLACED, {
      id: uuidv4(),
      type: EventType.ITEM_PLACED,
      timestamp: Date.now(),
      actorId,
      itemId: itemIdToPlace,
      targetId,
    });

    const itemDesc = getComponent<DescriptionComponent>(worldState, itemIdToPlace, DESCRIPTION_COMPONENT_TYPE);
    const targetDesc = getComponent<DescriptionComponent>(worldState, targetId, DESCRIPTION_COMPONENT_TYPE);
    clientData.connection.send(JSON.stringify({
      type: 'text',
      payload: `Inserisci ${itemDesc?.name ?? 'l\'oggetto'} in ${targetDesc?.name ?? 'qualcosa'}.`
    }));
  });

  gameEventEmitter.on<UseCommandEvent>(EventType.USE_COMMAND, async (event) => {
    const { actorId, itemKeywords, targetKeywords } = event;
    server.log.info(`[UseCommand] Received for actor ${actorId}: item "${itemKeywords}", target "${targetKeywords}"`);

    if (!worldState) return;

    // 1. Find player's connection
    let clientData;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    if (!clientData) {
      server.log.warn(`[UseCommand] Could not find client for actor ${actorId}`);
      return;
    }

    // 2. Resolve the item from the player's inventory
    const playerInventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
    if (!playerInventory || playerInventory.items.length === 0) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non hai un "${itemKeywords}".` }));
      return;
    }

    const itemSearchTerms = itemKeywords.toLowerCase().split(' ').filter(t => t);
    let itemToUseId: EntityId | null = null;
    for (const itemId of playerInventory.items) {
      const description = getComponent<DescriptionComponent>(worldState, itemId, DESCRIPTION_COMPONENT_TYPE);
      if (description) {
        const entityKeywords = description.keywords.map(k => k.toLowerCase());
        const isMatch = itemSearchTerms.every(term => entityKeywords.some(keyword => keyword.includes(term)));
        if (isMatch) {
          itemToUseId = itemId;
          break;
        }
      }
    }

    if (!itemToUseId) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non hai un "${itemKeywords}".` }));
      return;
    }

    // 3. Resolve the target from the player's current room
    const location = getComponent<IsPresentInRoomComponent>(worldState, actorId, LOCATION_COMPONENT_TYPE);
    if (!location) {
      clientData.connection.send(JSON.stringify({ type: 'error', payload: "Non ti trovi in nessun luogo." }));
      return;
    }
    const roomInventory = getComponent<InventoryComponent>(worldState, location.roomId, INVENTORY_COMPONENT_TYPE);
    if (!roomInventory) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non vedi un "${targetKeywords}" qui.` }));
      return;
    }

    const targetSearchTerms = targetKeywords.toLowerCase().split(' ').filter(t => t);
    let targetId: EntityId | null = null;
    for (const entityId of roomInventory.items) {
      const description = getComponent<DescriptionComponent>(worldState, entityId, DESCRIPTION_COMPONENT_TYPE);
      if (description) {
        const entityKeywords = description.keywords.map(k => k.toLowerCase());
        const isMatch = targetSearchTerms.every(term => entityKeywords.some(keyword => keyword.includes(term)));
        if (isMatch) {
          targetId = entityId;
          break;
        }
      }
    }

    if (!targetId) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non vedi un "${targetKeywords}" qui.` }));
      return;
    }

    // 4. Fire the generic ItemUsedEvent for the dispatcher to handle puzzle logic
    gameEventEmitter.emit(EventType.ITEM_USED, {
      id: uuidv4(),
      type: EventType.ITEM_USED,
      timestamp: Date.now(),
      actorId,
      itemId: itemToUseId,
      targetId,
    });
  });

  gameEventEmitter.on<CommandFailedEvent>(EventType.COMMAND_FAILED, async (event) => {
    const { actorId, reason } = event;
    server.log.info(`[CommandFailed] Received for actor ${actorId} with reason "${reason}"`);

    if (!worldState) return;

    let clientData;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    if (!clientData) {
      server.log.warn(`[CommandFailed] Could not find client for actor ${actorId}`);
      return;
    }

    let message = "Comando non riuscito."; // Default message
    switch (reason) {
      case CommandFailureReason.EXIT_LOCKED:
        message = "La via è bloccata, non puoi procedere.";
        break;
      // TODO: Add other failure reasons here
    }

    clientData.connection.send(JSON.stringify({ type: 'text', payload: message }));
  });

  gameEventEmitter.on<ExamineCommandEvent>(EventType.EXAMINE_COMMAND, async (event) => {
    const { actorId, targetKeywords } = event;
    let clientData: { connection: WebSocket, playerId: EntityId, connectionId: string } | undefined;
    for (const data of clientConnections.values()) {
      if (data.playerId === actorId) {
        clientData = data;
        break;
      }
    }
    if (!clientData || !worldState) return;

    // 1. Find player's location
    const location = getComponent<IsPresentInRoomComponent>(worldState, actorId, LOCATION_COMPONENT_TYPE);
    if (!location) {
      clientData.connection.send(JSON.stringify({ type: 'error', payload: "Non ti trovi in nessun luogo." }));
      return;
    }
    const roomId = location.roomId;

    server.log.info(`[ExamineCommand] Room ID: ${roomId}`);

    // 2. Gather candidate items: player inventory, room inventory, and inventories of features in the room
    const playerInventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
    const roomInventory = getComponent<InventoryComponent>(worldState, roomId, INVENTORY_COMPONENT_TYPE);
    let candidateIds: EntityId[] = [];
    if (playerInventory) candidateIds.push(...playerInventory.items);
    if (roomInventory) candidateIds.push(...roomInventory.items);
    // Add items from inventories of features (e.g., sockets) in the room
    if (roomInventory) {
      for (const entityId of roomInventory.items) {
        const featureInventory = getComponent<InventoryComponent>(worldState, entityId, INVENTORY_COMPONENT_TYPE);
        if (featureInventory) candidateIds.push(...featureInventory.items);
      }
    }

    // 3. Find the target entity by keywords
    const targetEntityId = findTargetEntity(worldState, candidateIds, targetKeywords);
    if (!targetEntityId || targetEntityId === 'ambiguous') {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non trovi nessun oggetto che corrisponda a "${targetKeywords}".` }));
      return;
    }

    // 4. Check visibility (use same logic as look/pickup)
    const perception = getComponent<PerceptionComponent>(worldState, actorId, PERCEPTION_COMPONENT_TYPE);
    const knownHiddenItems = getComponent<KnownHiddenItemsComponent>(worldState, actorId, KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE);
    const sightLevel = perception?.sightLevel ?? 0;
    const knownItemIds = knownHiddenItems?.itemIds ?? [];
    const visibility = getComponent<IsVisibleComponent>(worldState, targetEntityId, VISIBLE_COMPONENT_TYPE);
    const isVisible = (visibility?.level ?? 0) <= sightLevel || knownItemIds.includes(targetEntityId);
    if (!isVisible) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: `Non riesci a esaminare nessun oggetto che corrisponda a "${targetKeywords}".` }));
      return;
    }

    // 5. Stream the detailed description
    const descriptionStream = await generateEntityDescriptionStream(
      llmProvider, worldState, targetEntityId, actorId, llmModel, 'examination'
    );
    clientData.connection.send('\n');
    for await (const chunk of descriptionStream) {
      if (clientConnections.has(clientData.connectionId)) {
        clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: chunk }));
      } else {
        break;
      }
    }
    if (clientConnections.has(clientData.connectionId)) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));
    }
  });

  gameEventEmitter.on<DropCommandEvent>(EventType.DROP_COMMAND, async (event) => {
    server.log.info(`[DropCommand] Received event: ${event.type}`);

    const { actorId, targetKeywords } = event;
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
      server.log.warn(`[DropCommand] Could not find client connection for actor ${actorId}`);
      return;
    }

    // 2. Find the player's location and inventory
    const location = getComponent<IsPresentInRoomComponent>(worldState, actorId, LOCATION_COMPONENT_TYPE);
    if (!location) {
      // This case should ideally not happen if the player is in the world.
      server.log.error(`[DropCommand] Actor ${actorId} has no location.`);
      return;
    }
    const roomId = location.roomId;
    const playerInventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
    if (!playerInventory || playerInventory.items.length === 0) {
      clientData.connection.send(JSON.stringify({ type: 'text', payload: "You aren't carrying anything." }));
      return;
    }

    // 3. Resolve the target item from the player's inventory
    const targetItemId = findTargetEntity(worldState, playerInventory.items, targetKeywords);

    if (!targetItemId || targetItemId === 'ambiguous') {
      const reason = targetItemId === 'ambiguous'
        ? "You're carrying more than one of those. Be more specific."
        : "You aren't carrying that.";
      clientData.connection.send(JSON.stringify({ type: 'text', payload: reason }));
      return;
    }

    // 4. Fire the ItemDroppedEvent for the state change
    const itemDroppedEvent: ItemDroppedEvent = {
      id: uuidv4(),
      type: EventType.ITEM_DROPPED,
      timestamp: Date.now(),
      actorId,
      itemId: targetItemId,
      roomId,
    };
    gameEventEmitter.emit(EventType.ITEM_DROPPED, itemDroppedEvent);

    // 5. Send feedback to the player
    const itemDescription = getComponent<DescriptionComponent>(worldState, targetItemId, DESCRIPTION_COMPONENT_TYPE);
    const itemName = itemDescription?.name ?? 'the item';
    clientData.connection.send(JSON.stringify({ type: 'text', payload: `You drop ${itemName}.` }));

  });
}

export { setGameEventEmitter };