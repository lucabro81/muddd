import {
  DropCommandEvent,
  InventoryComponent,
  LOCATION_COMPONENT_TYPE,
  IsPresentInRoomComponent,
  getComponent,
  WorldType,
  INVENTORY_COMPONENT_TYPE,
  findTargetEntity,
  ItemDroppedEvent,
  EventType,
  gameEventEmitter,
  DescriptionComponent,
  DESCRIPTION_COMPONENT_TYPE
} from "core/main.js";
import { server } from "../../utils.js";
import { ClientConnection, ClientConnetionMap } from "../types.js";
import { v4 as uuidv4 } from 'uuid';

export const dropCommandEventHandler = async (event: DropCommandEvent,
  worldState: WorldType | null,
  clientConnections: ClientConnetionMap,
) => {
  server.log.info(`[DropCommand] Received event: ${event.type}`);

  const { actorId, targetKeywords } = event;
  if (!worldState) return;

  // 1. Find the player's connection
  let clientData: ClientConnection | undefined;
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

}