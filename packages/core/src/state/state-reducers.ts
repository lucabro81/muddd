// packages/core/src/state-reducers.ts

import { WorldType, EntityId, ComponentType, IComponent } from '../common/types';
import { GameEvent, EntityMoveEvent, EventType } from '../events/events.types';
import { IsPresentInRoomComponent, LOCATION_COMPONENT_TYPE } from '../common/types';

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