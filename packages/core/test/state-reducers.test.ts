import { describe, it, expect, beforeEach } from 'vitest';
import { loadWorldStateFromFile } from '../src/utils/world-loader';
import { entityUnlockedReducer, itemSocketedReducer } from '../src/state/state-reducers';
import {
  WorldType,
  EntityId,
  LOCKED_COMPONENT_TYPE,
  INVENTORY_COMPONENT_TYPE,
  InventoryComponent,
  LOCATION_COMPONENT_TYPE,
  SOCKET_COMPONENT_TYPE,
  SocketComponent,
  PICKUPABLE_COMPONENT_TYPE,
  IComponent
} from '../src/common/types';
import {
  EntityUnlockedEvent,
  EventType,
  ItemSocketedEvent
} from '../src/events/events.types';

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

  describe('itemSocketedReducer', () => {
    const actorId: EntityId = 'player_test';
    const itemId: EntityId = 'frammento_iscrizione_infernale';
    const targetId: EntityId = 'architrave_con_iscrizione';
    let testState: WorldType;

    beforeEach(() => {
      // ARRANGE: Create a test-specific state where the player has the item.
      const playerComponents = new Map(initialState.get(actorId)!);
      const playerInventory = playerComponents.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
      const nextPlayerInventory: InventoryComponent = {
        ...playerInventory,
        items: [...playerInventory.items, itemId],
      };
      playerComponents.set(INVENTORY_COMPONENT_TYPE, nextPlayerInventory);

      const itemComponents = new Map(initialState.get(itemId)!);
      itemComponents.delete(LOCATION_COMPONENT_TYPE); // Item is in inventory, not in a room

      const roomComponents = new Map(initialState.get('porta_dell_inferno')!);
      const roomInventory = roomComponents.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
      const nextRoomInventory: InventoryComponent = {
        ...roomInventory,
        items: roomInventory.items.filter(id => id !== itemId),
      };
      roomComponents.set(INVENTORY_COMPONENT_TYPE, nextRoomInventory);

      // Create the state copy for the test
      testState = new Map(initialState);
      testState.set(actorId, playerComponents);
      testState.set(itemId, itemComponents);
      testState.set('porta_dell_inferno', roomComponents);

      // Sanity check preconditions
      const prePlayerInv = testState.get(actorId)!.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
      expect(prePlayerInv.items).toContain(itemId);
      const preSocket = testState.get(targetId)!.get(SOCKET_COMPONENT_TYPE) as SocketComponent;
      expect(preSocket.isOccupied).toBe(false);
    });

    it('should correctly socket the item, updating actor, item, and target states', () => {
      // Arrange: Create the event
      const event: ItemSocketedEvent = {
        id: 'test-socket-evt-1',
        type: EventType.ITEM_SOCKETED,
        timestamp: Date.now(),
        actorId,
        itemId,
        targetId,
      };

      // Action: Apply the event using the (currently empty) reducer
      const nextState = itemSocketedReducer(testState, event);

      // Assert: Verify the new state
      expect(nextState).not.toBe(testState); // Immutability

      // 1. Target (Socket) State
      const nextTarget = nextState.get(targetId)!;
      const nextSocket = nextTarget.get(SOCKET_COMPONENT_TYPE) as SocketComponent;
      expect(nextSocket.isOccupied).toBe(true);

      // 2. Actor (Player) State
      const nextActor = nextState.get(actorId)!;
      const nextActorInventory = nextActor.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent;
      expect(nextActorInventory.items).not.toContain(itemId);

      // 3. Item State
      const nextItem = nextState.get(itemId)!;
      console.log("nextItem: ");
      console.dir(nextItem, { depth: null, colors: true });
      expect(nextItem.has(PICKUPABLE_COMPONENT_TYPE)).toBe(false); // Should become non-pickupable
    });
  });
}); 