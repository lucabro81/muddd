import { WorldType } from '../common/types';
import { GameEvent, EventType, EntityMoveEvent } from '../events/events.types';
import { entityMoveReducer } from './state-reducers';

/**
 * Central function to apply an event to the world state.
 * Determines the appropriate reducer based on the event type
 * and returns the new world state.
 * Operates in an immutable way.
 *
 * @param currentState The current world state.
 * @param event The game event to apply.
 * @returns The new world state after applying the event.
 */
export function applyEvent(currentState: WorldType, event: GameEvent): WorldType {

  switch (event.type) {
    case EventType.ENTITY_MOVE:
      // Call the specific reducer for this event type.
      // We use a type assertion 'as' because we know that at this point
      // the event is definitely of type EntityMoveEvent.
      // Alternative: use a type guard.
      return entityMoveReducer(currentState, event as EntityMoveEvent);

    // TODO:
    // --- Future cases ---
    // case EventType.PLAYER_COMMAND:
    //     // Might not modify the state directly, but trigger other events
    //     return currentState;
    // case EventType.SOME_OTHER_STATE_CHANGE:
    //     // return someOtherReducer(currentState, event as SomeOtherEvent);
    //     return currentState; // Placeholder

    default:
      // If the event is not recognized or does not cause state changes,
      // returns the current state without modifications.
      console.log(`[applyEvent] No state reducer registered for event type: ${event.type}`);
      return currentState;
  }
}