import { describe, it, expect, beforeEach } from 'vitest';
import { loadWorldStateFromFile } from '../src/utils/world-loader';
import { applyEvent } from '../src/state/state-dispatcher';
import { WorldType, EntityId } from '../src/common/types.js';
import { GameEvent, EntityMoveEvent, EventType } from '../src/events/events.types.js';
import { IsPresentInRoomComponent, LOCATION_COMPONENT_TYPE } from '../src/common/types.js';

const WORLD_FIXTURE_PATH = 'test/fixtures/test-world.json';

describe('State Dispatcher (applyEvent)', () => {
  let initialState: WorldType;
  const movingEntityId: EntityId = 'player_test';
  const originRoomId: EntityId = 'porta_dell_inferno';
  const destinationRoomId: EntityId = 'antinferno';

  // Load the initial state before each test
  beforeEach(() => {
    initialState = loadWorldStateFromFile(WORLD_FIXTURE_PATH);
    // Base check that the state is loaded and the entity exists
    expect(initialState.has(movingEntityId)).toBe(true);
    const initialLocation = initialState.get(movingEntityId)?.get(LOCATION_COMPONENT_TYPE) as IsPresentInRoomComponent | undefined;
    expect(initialLocation?.roomId).toBe(originRoomId);
  });

  it('should correctly apply EntityMoveEvent using entityMoveReducer', () => {
    // Arrange: Create the move event
    const moveEvent: EntityMoveEvent = {
      id: 'test-evt-move-1',
      type: EventType.ENTITY_MOVE,
      timestamp: Date.now(),
      entityId: movingEntityId,
      originRoomId: originRoomId, // Not strictly used by the reducer but part of the event
      destinationRoomId: destinationRoomId,
    };

    // Action: Apply the event to the initial state
    const nextState = applyEvent(initialState, moveEvent);

    // Assert: Verify the new state

    // 1. Immutability: The returned state MUST NOT be the same object as the initial state
    expect(nextState).not.toBe(initialState);

    // 2. Entity exists: The moved entity must exist in the new state
    expect(nextState.has(movingEntityId)).toBe(true);
    const nextEntityComponents = nextState.get(movingEntityId);
    expect(nextEntityComponents).toBeDefined();

    // 3. Updated component: The location component must be updated
    expect(nextEntityComponents?.has(LOCATION_COMPONENT_TYPE)).toBe(true);
    const nextLocation = nextEntityComponents?.get(LOCATION_COMPONENT_TYPE) as IsPresentInRoomComponent | undefined;
    expect(nextLocation).toBeDefined();
    expect(nextLocation?.roomId).toBe(destinationRoomId); // The room has changed!

    // 4. Other components unchanged (partial check): Verify that other components are not touched
    expect(nextEntityComponents?.has('description')).toBe(initialState.get(movingEntityId)?.has('description'));
    expect(nextEntityComponents?.get('description')).toEqual(initialState.get(movingEntityId)?.get('description')); // Deep equality check

    // 5. Other entities unchanged (partial check): Verify that another entity is not changed
    expect(nextState.get('porta_dell_inferno')).toEqual(initialState.get('porta_dell_inferno')); // Deep equality check


  });

  it('should return the current state for unhandled event types', () => {
    // Arrange: Create a fake unhandled event
    const unhandledEvent: GameEvent = {
      id: 'test-evt-unhandled-1',
      // @ts-expect-error -- Simulating an unknown event type string
      type: 'SOME_UNKNOWN_EVENT_TYPE',
      timestamp: Date.now(),
      // Add other properties if the GameEvent definition requires them
    };

    // Action: Apply the event
    const nextState = applyEvent(initialState, unhandledEvent);

    // Assert: The returned state MUST be the same object as the initial state (or deep equal)
    // because no reducer should have touched it
    expect(nextState).toBe(initialState);
    // Alternatively, if there was a risk of accidental internal mutation:
    // expect(nextState).toEqual(initialState); // Deep equality check
  });

  // TODO: Add specific tests for other reducers when they are implemented
});

describe('applyEvent exhaustiveness', () => {
  // Events that have a dedicated, simple reducer function
  const stateChangingReducerEvents: EventType[] = [
    EventType.ENTITY_MOVE,
    EventType.PLAYER_DISCOVERED_ITEM,
    EventType.ITEM_PICKED_UP,
    EventType.ITEM_SOCKETED,
    EventType.ENTITY_UNLOCKED,
    EventType.ITEM_PLACED
  ];

  // Events handled by custom logic within the applyEvent switch statement
  const customLogicEvents: EventType[] = [
    EventType.ITEM_USED,
    EventType.PLAYER_COMMAND,
  ];

  // Events that are intentionally not handled by a state-changing case
  // and should fall through to the default case, returning the state unmodified.
  // These are typically command intents or purely informational events.
  const nonStateChangingEvents: EventType[] = [
    EventType.UNKNOWN_COMMAND,
    EventType.LOOK_COMMAND,
    EventType.GO_COMMAND,
    EventType.GET_COMMAND,
    EventType.DROP_COMMAND,
    EventType.INVENTORY_COMMAND,
    EventType.PUSH_COMMAND,
    EventType.PLAYER_ENTERED_ROOM,
    EventType.PLAYER_LEFT_ROOM,
    EventType.LOOK_TARGET,
    EventType.ITEM_GET,
    EventType.LOOK_ROOM,
    EventType.SEARCH_COMMAND,
    EventType.PICKUP_COMMAND,
    EventType.ITEM_DROPPED,
    EventType.BUTTON_PUSHED,
    EventType.EXAMINE_COMMAND,
    EventType.PUT_COMMAND,
    EventType.USE_COMMAND,
    EventType.COMMAND_FAILED,
    EventType.STATE_UPDATED,
  ];

  it('should consciously handle every EventType', () => {
    const allEventTypes = Object.values(EventType);

    const allHandledEvents = [
      ...stateChangingReducerEvents,
      ...customLogicEvents,
      ...nonStateChangingEvents,
    ];

    // This test ensures that if a new EventType is added, the developer
    // must consciously decide how it should be handled by the dispatcher
    // and add it to one of the lists above.
    expect(new Set(allEventTypes)).toEqual(new Set(allHandledEvents));
  });

  it('should return the original state for non-state-changing event types', () => {
    const currentState: WorldType = new Map();

    nonStateChangingEvents.forEach(eventType => {
      const event = {
        id: `test-event-${eventType}`,
        type: eventType,
        timestamp: Date.now(),
      };

      const newState = applyEvent(currentState, event as GameEvent);
      expect(newState).toBe(currentState);
    });
  });
});