// packages/core/src/events/events.types.ts
import { EntityId, RoomId, Timestamp } from '../common/types.js';

export enum EventType {
  PLAYER_COMMAND = 'PlayerCommand',
  ENTITY_MOVE = 'EntityMove',
  LOOK_TARGET = 'LookTarget',
  ITEM_GET = 'ItemGet',
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

export interface LookTargetEvent extends BaseEvent {
  type: EventType.LOOK_TARGET;
  actorId: EntityId;
  targetEntityId: EntityId;
}

export interface ItemGetEvent extends BaseEvent {
  type: EventType.ITEM_GET;
  actorId: EntityId;
  itemId: EntityId;
  roomId: RoomId;
}

export type GameEvent = EntityMoveEvent | PlayerCommandEvent | LookTargetEvent | ItemGetEvent;