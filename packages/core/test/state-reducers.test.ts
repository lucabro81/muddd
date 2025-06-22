import { describe, it, expect, beforeEach } from 'vitest';
import { loadWorldStateFromFile } from '../src/utils/world-loader.js';
import { WorldType, EntityId, LOCKED_COMPONENT_TYPE, IComponent } from '../src/common/types.js';
import { EntityUnlockedEvent, EventType } from '../src/events/events.types.js';
import { entityUnlockedReducer } from '../src/state/state-reducers.js';

const WORLD_FIXTURE_PATH = 'test/fixtures/test-world.json';

describe('State Reducers', () => {
  let initialState: WorldType;
  const lockedEntityId: EntityId = 'exit_porta_inferno_nord';

  beforeEach(() => {
    initialState = loadWorldStateFromFile(WORLD_FIXTURE_PATH);
    // Base check that the state is loaded and the entity is initially locked
    expect(initialState.has(lockedEntityId)).toBe(true);
    const lockedComponent = initialState.get(lockedEntityId)?.get(LOCKED_COMPONENT_TYPE) as IComponent | undefined;
    expect(lockedComponent).toBeDefined();
  });

  describe('entityUnlockedReducer', () => {
    it('should remove the LockedComponent from the specified entity', () => {
      // Arrange: Create the unlock event
      const unlockEvent: EntityUnlockedEvent = {
        id: 'test-evt-unlock-1',
        type: EventType.ENTITY_UNLOCKED,
        timestamp: Date.now(),
        actorId: 'player-1', // The actor who triggered the unlock
        entityId: lockedEntityId,
      };

      // Action: Apply the event via the reducer
      const nextState = entityUnlockedReducer(initialState, unlockEvent);

      // Assert: Verify the new state

      // 1. Immutability: The new state object should be different
      expect(nextState).not.toBe(initialState);

      // 2. Component Removed: The LockedComponent should no longer be on the entity
      const nextEntityComponents = nextState.get(lockedEntityId);
      expect(nextEntityComponents).toBeDefined();
      expect(nextEntityComponents?.has(LOCKED_COMPONENT_TYPE)).toBe(false);

      // 3. Other components unchanged: Verify that other components on the same entity are not touched
      expect(nextEntityComponents?.has('description')).toBe(true);
      expect(nextEntityComponents?.get('description')).toEqual(initialState.get(lockedEntityId)?.get('description'));

      // 4. Other entities unchanged: Verify a different entity is untouched
      expect(nextState.get('porta_dell_inferno')).toEqual(initialState.get('porta_dell_inferno'));
    });
  });
}); 