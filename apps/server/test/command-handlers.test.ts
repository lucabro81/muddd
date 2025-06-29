import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  gameEventEmitter,
  EventType,
  DropCommandEvent,
  ItemDroppedEvent,
  WorldType,
  EntityId,
  INVENTORY_COMPONENT_TYPE,
  InventoryComponent,
  LOCATION_COMPONENT_TYPE,
  IsPresentInRoomComponent,
  IComponent,
  loadWorldStateFromFile,
  PickupCommandEvent,
  ItemPickedUpEvent
} from 'core/main.js';
import { setGameEventEmitter } from '../src/game-event-emitter';
import { WebSocket } from 'ws';

const WORLD_FIXTURE_PATH = 'test/fixtures/test-world.json';

describe('Command Handlers', () => {

  let worldState: WorldType | null = null;
  const actorId: EntityId = 'player_test';
  const itemId: EntityId = 'item1';
  const roomId: EntityId = 'porta_dell_inferno';
  const connectionId: string = 'test-connection';

  beforeEach(() => {
    // Reset listeners before each test to ensure isolation
    gameEventEmitter.removeAllListeners();

    // Setup a mock world state
    const playerComponents = new Map<string, IComponent>([
      [INVENTORY_COMPONENT_TYPE, { type: INVENTORY_COMPONENT_TYPE, items: [itemId] } as InventoryComponent],
      [LOCATION_COMPONENT_TYPE, { type: LOCATION_COMPONENT_TYPE, roomId: roomId } as IsPresentInRoomComponent]
    ]);

    const roomComponents = new Map<string, IComponent>([
      [INVENTORY_COMPONENT_TYPE, { type: INVENTORY_COMPONENT_TYPE, items: [] } as InventoryComponent]
    ]);

    worldState = loadWorldStateFromFile(WORLD_FIXTURE_PATH);
    console.log(`[Command Handlers] World state: ${worldState?.size}`);

    // Setup mock client connections
    const mockClientConnections = new Map([
      [connectionId, {
        connection: {
          send: (message: string) => {
            console.log(`[Command Handlers] Mock WebSocket send: ${message}`);
          },
        } as unknown as WebSocket, // Mock WebSocket, doesn't need to be functional
        playerId: actorId,
        connectionId: connectionId
      }]
    ]);

    // Initialize the command handlers with the current world state
    setGameEventEmitter(worldState, mockClientConnections);
  });

  describe('dropCommandHandler', () => {
    it('should emit an ItemDroppedEvent when a player drops a valid item', async () => {
      // ARRANGE
      const dropCommand: DropCommandEvent = {
        id: 'drop-cmd-1',
        type: EventType.DROP_COMMAND,
        timestamp: Date.now(),
        actorId: actorId,
        targetKeywords: 'item1', // For this test, we assume target resolution is successful
      };

      const spy = vi.fn();
      gameEventEmitter.on<ItemDroppedEvent>(EventType.ITEM_DROPPED, spy);

      // // ACTIONS
      gameEventEmitter.emit(EventType.DROP_COMMAND, dropCommand)

      // // ASSERT
      // We need to give the event loop a chance to process the event
      await new Promise(resolve => setImmediate(resolve));

      expect(spy).toHaveBeenCalledOnce();
      const emittedEvent = spy.mock.calls[0][0] as ItemDroppedEvent;
      expect(emittedEvent.type).toBe(EventType.ITEM_DROPPED);
      expect(emittedEvent.actorId).toBe(actorId);
      expect(emittedEvent.itemId).toBe(itemId);
      expect(emittedEvent.roomId).toBe(roomId);
    });
  });
}); 