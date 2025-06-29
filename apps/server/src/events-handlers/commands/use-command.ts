import {
  DESCRIPTION_COMPONENT_TYPE,
  DescriptionComponent,
  EntityId,
  EventType,
  gameEventEmitter,
  getComponent,
  INVENTORY_COMPONENT_TYPE,
  InventoryComponent,
  IsPresentInRoomComponent,
  LOCATION_COMPONENT_TYPE,
  UseCommandEvent,
  WorldType
} from "core/main.js";
import { server } from "../../utils.js";
import { v4 as uuidv4 } from 'uuid';
import { ClientConnetionMap } from "../types.js";

export const useCommandEventHandler = (event: UseCommandEvent,
  worldState: WorldType | null,
  clientConnections: ClientConnetionMap,
) => {
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
}