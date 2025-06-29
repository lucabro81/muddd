import { EventType, gameEventEmitter, SearchCommandEvent, WorldType } from "core/main.js";
import { getComponent, IsPresentInRoomComponent, LOCATION_COMPONENT_TYPE, PerceptionComponent, PERCEPTION_COMPONENT_TYPE, VisibilityLevel } from "core/main.js";
import { InventoryComponent, INVENTORY_COMPONENT_TYPE } from "core/main.js";
import { IsVisibleComponent, VISIBLE_COMPONENT_TYPE } from "core/main.js";
import { EntityId } from "core/main.js";
import { DescriptionComponent, DESCRIPTION_COMPONENT_TYPE } from "core/main.js";
import { ClientConnection, ClientConnetionMap } from "../types.js";
import { server } from "../../utils.js";
import { v4 as uuidv4 } from 'uuid';

export const searchCommandEventHandler = async (
  event: SearchCommandEvent,
  worldState: WorldType | null,
  clientConnections: ClientConnetionMap,
) => {
  server.log.info(`[SearchCommand] Received event: ${event.type}`);

  const { actorId } = event;
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
}