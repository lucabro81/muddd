import {
  DESCRIPTION_COMPONENT_TYPE,
  DescriptionComponent,
  EventType,
  findTargetEntity,
  gameEventEmitter,
  getComponent,
  INVENTORY_COMPONENT_TYPE,
  InventoryComponent,
  IsPickupableComponent,
  IsPresentInRoomComponent,
  IsVisibleComponent,
  KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE,
  KnownHiddenItemsComponent,
  LOCATION_COMPONENT_TYPE,
  PERCEPTION_COMPONENT_TYPE,
  PerceptionComponent,
  PICKUPABLE_COMPONENT_TYPE,
  PickupCommandEvent,
  VISIBLE_COMPONENT_TYPE,
  WorldType
} from "core/main.js";
import { connectionsClientData, server } from "../../utils.js";
import { v4 as uuidv4 } from 'uuid';

export const pickCommandEventHandler = async (
  event: PickupCommandEvent,
  worldState: WorldType | null,
) => {
  const { actorId, targetKeywords } = event;
  console.log(`[PickupCommand] Received for actor ${actorId} with keywords "${targetKeywords}"`);
  server.log.info(`[PickupCommand] Received for actor ${actorId} with keywords "${targetKeywords}"`);

  if (!worldState) return;

  // 1. Find player's connection
  const clientData = connectionsClientData(actorId);

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
}