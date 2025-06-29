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
  PutCommandEvent,
  SOCKET_COMPONENT_TYPE,
  SocketComponent,
  WorldType
} from "core/main.js";
import { connectionsClientData, server } from "../../utils.js";
import { v4 as uuidv4 } from 'uuid';

export const putCommandEventHandler = async (event: PutCommandEvent,
  worldState: WorldType | null,
) => {
  const { actorId, itemKeywords, targetKeywords } = event;
  server.log.info(`[PutCommand] Received for actor ${actorId}: item "${itemKeywords}", target "${targetKeywords}"`);

  if (!worldState) return;

  // 1. Find player's connection
  const clientData = connectionsClientData(actorId);

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
}