import { EntityId, RoomId, Timestamp } from '../common/types.js';

export enum EventType {
  UNKNOWN_COMMAND = 'UnknownCommand',
  LOOK_COMMAND = 'LookCommand',
  GO_COMMAND = 'GoCommand',
  GET_COMMAND = 'GetCommand',
  DROP_COMMAND = 'DropCommand',
  INVENTORY_COMMAND = 'InventoryCommand',
  PUSH_COMMAND = 'PushCommand',
  PLAYER_ENTERED_ROOM = 'PlayerEnteredRoom',
  PLAYER_LEFT_ROOM = 'PlayerLeftRoom',
  PLAYER_COMMAND = 'PlayerCommand',
  ENTITY_MOVE = 'EntityMove',
  LOOK_TARGET = 'LookTarget',
  ITEM_GET = 'ItemGet',
  LOOK_ROOM = 'LookRoom',
  SEARCH_COMMAND = 'SearchCommand',
  PLAYER_DISCOVERED_ITEM = 'PlayerDiscoveredItem',
  PICKUP_COMMAND = 'PickupCommand',
  ITEM_PICKED_UP = 'ItemPickedUp',
  ITEM_DROPPED = 'ItemDropped',
  BUTTON_PUSHED = 'ButtonPushed',
  EXAMINE_COMMAND = 'ExamineCommand',
  PUT_COMMAND = 'PutCommand',
  USE_COMMAND = 'UseCommand',
  ENTITY_UNLOCKED = 'EntityUnlocked',
  ITEM_USED = 'ItemUsed',
  COMMAND_FAILED = 'CommandFailed',
  ITEM_SOCKETED = 'ItemSocketed',
}

export enum CommandFailureReason {
  TARGET_NOT_FOUND = 'TARGET_NOT_FOUND',
  DIRECTION_NOT_FOUND = 'DIRECTION_NOT_FOUND',
  EXIT_NOT_FOUND = 'EXIT_NOT_FOUND',
  EXIT_LOCKED = 'EXIT_LOCKED',
  ITEM_NOT_USABLE_ON_TARGET = 'ITEM_NOT_USABLE_ON_TARGET'
}

export interface BaseEvent {
  id: string; // event UUID
  type: EventType;
  timestamp: Timestamp;
  [key: string]: any;
  argString?: string;
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
  roomId: EntityId;
}

export interface InventoryCommandEvent extends BaseEvent {
  type: EventType.INVENTORY_COMMAND;
  actorId: EntityId;
}

export interface PutCommandEvent extends BaseEvent {
  type: EventType.PUT_COMMAND;
  actorId: EntityId;
  itemKeywords: string;
  targetKeywords: string;
}

export interface ExamineCommandEvent extends BaseEvent {
  type: EventType.EXAMINE_COMMAND;
  actorId: EntityId;
  targetKeywords: string;
}

export interface UseCommandEvent extends BaseEvent {
  type: EventType.USE_COMMAND;
  actorId: EntityId;
  itemKeywords: string;
  targetKeywords: string;
}

export interface ItemUsedEvent extends BaseEvent {
  type: EventType.ITEM_USED;
  actorId: EntityId;
  itemId: EntityId;
  targetId: EntityId;
}

export interface ItemSocketedEvent extends BaseEvent {
  type: EventType.ITEM_SOCKETED;
  actorId: EntityId;
  itemId: EntityId;
  targetId: EntityId;
}

export interface EntityUnlockedEvent extends BaseEvent {
  type: EventType.ENTITY_UNLOCKED;
  entityId: EntityId;
  actorId: EntityId;
}

export interface CommandFailedEvent extends BaseEvent {
  type: EventType.COMMAND_FAILED;
  actorId: EntityId;
  reason: CommandFailureReason;
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
  | InventoryCommandEvent
  | PutCommandEvent
  | ExamineCommandEvent
  | UseCommandEvent
  | EntityUnlockedEvent
  | ItemUsedEvent
  | ItemSocketedEvent
  | CommandFailedEvent;