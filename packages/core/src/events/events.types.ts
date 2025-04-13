// packages/core/src/events/events.types.ts
import { EntityId, RoomId, Timestamp } from '../common/types';

export enum EventType {
  PLAYER_COMMAND = 'PlayerCommand',
  ENTITY_MOVE = 'EntityMove',
}

export interface BaseEvent {
  id: string; // event UUID
  type: EventType;
  timestamp: Timestamp;
}

export interface EntityMoveEvent extends BaseEvent {
  type: EventType.ENTITY_MOVE;
  entityId: EntityId;
  originRoomId: RoomId;
  destinationRoomId: RoomId;
}

export type GameEvent = EntityMoveEvent;