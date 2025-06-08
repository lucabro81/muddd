import { EntityId, RoomId, Timestamp } from '../common/types.js';

export enum EventType {
  PLAYER_COMMAND = 'PlayerCommand',
  ENTITY_MOVE = 'EntityMove',
  LOOK_TARGET = 'LookTarget',
  ITEM_GET = 'ItemGet',
  LOOK_ROOM = 'LookRoom',
  SEARCH_COMMAND = 'SearchCommand',
  PLAYER_DISCOVERED_ITEM = 'PlayerDiscoveredItem',
  PICKUP_COMMAND = 'PickupCommand',
  ITEM_PICKED_UP = 'ItemPickedUp',
  INVENTORY_COMMAND = 'InventoryCommand',
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

export interface LookRoomEvent extends BaseEvent {
  type: EventType.LOOK_ROOM;
  actorId: EntityId;
  roomId: RoomId;
}

export interface SearchCommandEvent extends BaseEvent {
  type: EventType.SEARCH_COMMAND;
  actorId: EntityId;
}

export interface PlayerDiscoveredItemEvent extends BaseEvent {
  type: EventType.PLAYER_DISCOVERED_ITEM;
  actorId: EntityId;
  itemId: EntityId;
}

export interface PickupCommandEvent extends BaseEvent {
  type: EventType.PICKUP_COMMAND;
  actorId: EntityId;
  targetKeywords: string;
}

export interface ItemPickedUpEvent extends BaseEvent {
  type: EventType.ITEM_PICKED_UP;
  actorId: EntityId;
  itemId: EntityId;
}

export interface InventoryCommandEvent extends BaseEvent {
  type: EventType.INVENTORY_COMMAND;
  actorId: EntityId;
}

export type GameEvent =
  | EntityMoveEvent
  | PlayerCommandEvent
  | LookTargetEvent
  | ItemGetEvent
  | LookRoomEvent
  | SearchCommandEvent
  | PlayerDiscoveredItemEvent
  | PickupCommandEvent
  | ItemPickedUpEvent
  | InventoryCommandEvent;