// packages/core/src/state-reducers.ts

import { IsPresentInRoomComponent, KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE, KnownHiddenItemsComponent, LOCATION_COMPONENT_TYPE, WorldType } from '../common/types.js';
import { EntityMoveEvent, PlayerDiscoveredItemEvent } from '../events/events.types.js';
import util from 'util';
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
  console.log(`[entityMoveReducer] New state after moving entity ${entityId} to room ${destinationRoomId}: ${util.inspect(nextState)}`);
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