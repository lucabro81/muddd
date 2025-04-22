import { describe, it, expect, vi } from 'vitest';
import { gameEventEmitter } from '../src/events/game-event-emitter';
import { EventType, EntityMoveEvent } from '../src/events/events.types';

describe('GameEventEmitter', () => {
  it('should emit and receive a strongly typed event', () => {
    const listener = vi.fn();

    gameEventEmitter.on<EntityMoveEvent>(EventType.ENTITY_MOVE, listener);

    const moveEvent: EntityMoveEvent = {
      id: 'evt-123',
      type: EventType.ENTITY_MOVE,
      timestamp: Date.now(),
      entityId: 'player-1',
      originRoomId: 'room-start',
      destinationRoomId: 'room-hall',
    };

    gameEventEmitter.emit(EventType.ENTITY_MOVE, moveEvent);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(moveEvent);
  });
});