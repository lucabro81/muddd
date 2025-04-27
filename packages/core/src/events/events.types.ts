// packages/core/src/events/events.types.ts
import { EntityId, RoomId, Timestamp } from '../common/types.js';

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

export interface PlayerCommandEvent extends BaseEvent {
  type: EventType.PLAYER_COMMAND;
  entityId: EntityId;
  rawInput: RoomId;
  verb?: string;
  args?: string[];
  argString?: string;
}

export type GameEvent = EntityMoveEvent | PlayerCommandEvent;