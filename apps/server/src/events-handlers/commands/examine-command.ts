import {
  EntityId,
  ExamineCommandEvent,
  findTargetEntity,
  generateEntityDescriptionStream,
  getComponent,
  INVENTORY_COMPONENT_TYPE,
  InventoryComponent,
  IsPresentInRoomComponent,
  IsVisibleComponent,
  KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE,
  KnownHiddenItemsComponent,
  LOCATION_COMPONENT_TYPE,
  OllamaProvider,
  PERCEPTION_COMPONENT_TYPE,
  PerceptionComponent,
  VISIBLE_COMPONENT_TYPE,
  WorldType
} from "core/main.js";
import { ClientConnection, ClientConnetionMap } from "../types.js";
import { connectionsClientData, server } from "../../utils.js";

export const examineCommandEventHandler = async (event: ExamineCommandEvent,
  worldState: WorldType | null,
  clientConnections: ClientConnetionMap,
  llmProvider: OllamaProvider,
  llmModel: string,
) => {
  const { actorId, targetKeywords } = event;
  const clientData = connectionsClientData(actorId);
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
}