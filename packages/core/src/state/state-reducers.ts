import {
  INVENTORY_COMPONENT_TYPE,
  InventoryComponent,
  IsPickupableComponent,
  IsPresentInRoomComponent,
  KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE,
  KnownHiddenItemsComponent,
  LOCATION_COMPONENT_TYPE,
  LOCKED_COMPONENT_TYPE,
  PICKUPABLE_COMPONENT_TYPE,
  SOCKET_COMPONENT_TYPE,
  SocketComponent,
  WorldType
} from '../common/types.js';
import { EntityMoveEvent, EntityUnlockedEvent, ItemDroppedEvent, ItemPickedUpEvent, ItemSocketedEvent, PlayerDiscoveredItemEvent } from '../events/events.types.js';
/**
 * Manage the EntityMoveEvent event by updating the IsPresentInRoomComponent of the moved entity.
 * Operate in an immutable way, returning a new WorldType map.
 *
 * @param currentState The current world state (immutable).
 * @param event The EntityMoveEvent to process.
 * @returns The new world state with the moved entity.
 */
export function entityMoveReducer(
  currentState: WorldType,
  event: EntityMoveEvent
): WorldType {
  const { entityId, destinationRoomId } = event;

  // 1. Get the current components map for the entity
  const currentEntityComponents = currentState.get(entityId);

  if (!currentEntityComponents) {
    console.warn(`[entityMoveReducer] Entity ${entityId} not found in state. Ignoring move event.`);
    return currentState;
  }

  // 2. Create the NEW location component
  const newLocationComponent: IsPresentInRoomComponent = {
    type: LOCATION_COMPONENT_TYPE,
    roomId: destinationRoomId,
  };

  // 3. Create a NEW components map for the future entity,
  //    copying the old components and overwriting/adding the location component.
  //    This ensures the immutability at the entity's components level.
  const nextEntityComponents = new Map(currentEntityComponents);
  nextEntityComponents.set(LOCATION_COMPONENT_TYPE, newLocationComponent);

  // 4. Create a NEW state map for the future world,
  //    copying the old entities and updating the modified one.
  //    This ensures the immutability at the global state level.
  const nextState = new Map(currentState);
  nextState.set(entityId, nextEntityComponents);

  // 5. Return the NEW complete state
  return nextState;
}

export function playerDiscoveredItemReducer(
  currentState: WorldType,
  event: PlayerDiscoveredItemEvent
): WorldType {
  const { actorId, itemId } = event;

  // 1. Get the current components map for the player
  const playerComponents = currentState.get(actorId);
  if (!playerComponents) {
    console.warn(`[playerDiscoveredItemReducer] Player ${actorId} not found. Ignoring event.`);
    return currentState;
  }

  // 2. Get the existing KnownHiddenItemsComponent, or create a new one
  const knownItemsComponent = playerComponents.get(KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE) as KnownHiddenItemsComponent | undefined;

  const newKnownItems: KnownHiddenItemsComponent = {
    type: KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE,
    itemIds: knownItemsComponent ? [...knownItemsComponent.itemIds] : []
  };

  // 3. Add the new item ID if it's not already there
  if (!newKnownItems.itemIds.includes(itemId)) {
    newKnownItems.itemIds.push(itemId);
  } else {
    // If the item is already known, no state change is needed.
    return currentState;
  }

  // 4. Create a new components map for the player
  const nextPlayerComponents = new Map(playerComponents);
  nextPlayerComponents.set(KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE, newKnownItems);

  // 5. Create a new world state map
  const nextState = new Map(currentState);
  nextState.set(actorId, nextPlayerComponents);

  console.log(`[playerDiscoveredItemReducer] Player ${actorId} discovered item ${itemId}.`);
  return nextState;
}

export function itemPickedUpReducer(
  currentState: WorldType,
  event: ItemPickedUpEvent
): WorldType {
  const { actorId, itemId } = event;
  console.log(`[itemPickedUpReducer] Processing event for actor ${actorId} picking up item ${itemId}`);

  // --- 1. Get current state of all involved entities ---
  const actorComponents = currentState.get(actorId);
  const itemComponents = currentState.get(itemId);

  if (!actorComponents || !itemComponents) {
    console.warn(`[itemPickedUpReducer] Actor or Item not found. Aborting.`);
    return currentState;
  }

  const itemLocation = itemComponents.get(LOCATION_COMPONENT_TYPE) as IsPresentInRoomComponent | undefined;
  if (!itemLocation) {
    console.warn(`[itemPickedUpReducer] Item ${itemId} has no location. Aborting.`);
    return currentState;
  }
  const roomId = itemLocation.roomId;
  const roomComponents = currentState.get(roomId);

  if (!roomComponents) {
    console.warn(`[itemPickedUpReducer] Room ${roomId} not found. Aborting.`);
    return currentState;
  }

  // --- 2. Create the next state for all entities IMMUTABLY ---

  // a. Update Room: Remove item from inventory
  const currentRoomInventory = roomComponents.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
  const nextRoomInventory: InventoryComponent = {
    ...currentRoomInventory,
    items: currentRoomInventory.items.filter(id => id !== itemId),
  };
  const nextRoomComponents = new Map(roomComponents);
  nextRoomComponents.set(INVENTORY_COMPONENT_TYPE, nextRoomInventory);

  // b. Update Actor: Add item to inventory
  const currentActorInventory = actorComponents.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
  const nextActorInventory: InventoryComponent = {
    ...currentActorInventory,
    items: [...currentActorInventory.items, itemId],
  };
  const nextActorComponents = new Map(actorComponents);
  nextActorComponents.set(INVENTORY_COMPONENT_TYPE, nextActorInventory);

  // c. Update Item: Remove its location component
  const nextItemComponents = new Map(itemComponents);
  nextItemComponents.delete(LOCATION_COMPONENT_TYPE);

  // --- 3. Assemble the final world state ---
  const nextState = new Map(currentState);
  nextState.set(roomId, nextRoomComponents);
  nextState.set(actorId, nextActorComponents);
  nextState.set(itemId, nextItemComponents);

  console.log(`[itemPickedUpReducer] Successfully moved item ${itemId} from room ${roomId} to actor ${actorId}`);
  return nextState;
}

export function itemDroppedReducer(
  currentState: WorldType,
  event: ItemDroppedEvent
): WorldType {
  const { actorId, itemId, roomId } = event;
  console.log(`[itemDroppedReducer] Processing event for actor ${actorId} dropping item ${itemId} in room ${roomId}`);

  // --- 1. Get current state of all involved entities ---
  const actorComponents = currentState.get(actorId);
  const itemComponents = currentState.get(itemId);
  const roomComponents = currentState.get(roomId);

  if (!actorComponents || !itemComponents || !roomComponents) {
    console.warn(`[itemDroppedReducer] Actor, Item, or Room not found. Aborting.`);
    return currentState;
  }

  // --- 2. Create the next state for all entities IMMUTABLY ---

  // a. Update Actor: Remove item from inventory
  const currentActorInventory = actorComponents.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
  const nextActorInventory: InventoryComponent = {
    ...currentActorInventory,
    items: currentActorInventory.items.filter(id => id !== itemId),
  };
  const nextActorComponents = new Map(actorComponents);
  nextActorComponents.set(INVENTORY_COMPONENT_TYPE, nextActorInventory);

  // b. Update Room: Add item to inventory
  const currentRoomInventory = roomComponents.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
  const nextRoomInventory: InventoryComponent = {
    ...currentRoomInventory,
    items: [...currentRoomInventory.items, itemId],
  };
  const nextRoomComponents = new Map(roomComponents);
  nextRoomComponents.set(INVENTORY_COMPONENT_TYPE, nextRoomInventory);

  // c. Update Item: Add a location component to it
  const nextItemComponents = new Map(itemComponents);
  const newLocationComponent: IsPresentInRoomComponent = {
    type: LOCATION_COMPONENT_TYPE,
    roomId,
  };
  nextItemComponents.set(LOCATION_COMPONENT_TYPE, newLocationComponent);

  // --- 3. Assemble the final world state ---
  const nextState = new Map(currentState);
  nextState.set(actorId, nextActorComponents);
  nextState.set(roomId, nextRoomComponents);
  nextState.set(itemId, nextItemComponents);

  console.log(`[itemDroppedReducer] Successfully moved item ${itemId} from actor ${actorId} to room ${roomId}`);
  return nextState;
}

export function itemSocketedReducer(
  currentState: WorldType,
  event: ItemSocketedEvent
): WorldType {
  const { actorId, itemId, targetId } = event;
  console.log(`[itemSocketedReducer] Processing event for actor ${actorId} placing item ${itemId} in target ${targetId}`);

  // --- 1. Get current state of all involved entities ---
  const actorComponents = currentState.get(actorId);
  const itemComponents = currentState.get(itemId);
  const targetComponents = currentState.get(targetId);

  if (!actorComponents || !itemComponents || !targetComponents) {
    console.warn(`[itemSocketedReducer] Actor, Item, or Target not found. Aborting.`);
    return currentState;
  }

  // --- 2. Create the next state for all entities IMMUTABLY ---

  // a. Update Actor: Remove item from inventory
  const currentActorInventory = actorComponents.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
  const nextActorInventory: InventoryComponent = {
    ...currentActorInventory,
    items: currentActorInventory.items.filter(id => id !== itemId),
  };
  const nextActorComponents = new Map(actorComponents);
  nextActorComponents.set(INVENTORY_COMPONENT_TYPE, nextActorInventory);

  // b. Update Target: Set socket to occupied
  const currentSocket = targetComponents.get(SOCKET_COMPONENT_TYPE) as SocketComponent;
  const nextSocket: SocketComponent = {
    ...currentSocket,
    isOccupied: true,
  };
  const nextTargetComponents = new Map(targetComponents);
  nextTargetComponents.set(SOCKET_COMPONENT_TYPE, nextSocket);

  // c. Update Item: Remove its pickupable component if necessary
  const nextItemComponents = new Map(itemComponents);
  const pickupable = nextItemComponents.get(PICKUPABLE_COMPONENT_TYPE) as IsPickupableComponent | undefined;

  // If the component exists and explicitly says it is not pickable when installed, remove it.
  if (pickupable && pickupable.pickableWhenInstalled === false) {
    nextItemComponents.delete(PICKUPABLE_COMPONENT_TYPE);
  }

  // --- 3. Assemble the final world state ---
  const nextState = new Map(currentState);
  nextState.set(actorId, nextActorComponents);
  nextState.set(targetId, nextTargetComponents);
  nextState.set(itemId, nextItemComponents);

  console.log(`[itemSocketedReducer] Successfully placed item ${itemId} in target ${targetId}`);
  return nextState;
}

export function entityUnlockedReducer(
  currentState: WorldType,
  event: EntityUnlockedEvent
): WorldType {
  const { entityId } = event;
  console.log(`[entityUnlockedReducer] Processing event for entity ${entityId}`);

  // 1. Get the current components map for the entity
  const entityComponents = currentState.get(entityId);
  if (!entityComponents) {
    console.warn(`[entityUnlockedReducer] Entity ${entityId} not found. Aborting.`);
    return currentState;
  }

  // 2. Check if the entity has the LockedComponent
  if (!entityComponents.has(LOCKED_COMPONENT_TYPE)) {
    console.warn(`[entityUnlockedReducer] Entity ${entityId} is not locked. Aborting.`);
    return currentState;
  }

  // 3. Create a new components map for the entity, removing the LockedComponent
  const nextEntityComponents = new Map(entityComponents);
  nextEntityComponents.delete(LOCKED_COMPONENT_TYPE);

  // 4. Create a new world state map
  const nextState = new Map(currentState);
  nextState.set(entityId, nextEntityComponents);

  console.log(`[entityUnlockedReducer] Successfully unlocked entity ${entityId}`);
  return nextState;
}