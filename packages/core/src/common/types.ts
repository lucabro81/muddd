export type EntityId = string;

export const DESCRIPTION_COMPONENT_TYPE = 'description';
export const CONNECTIONS_COMPONENT_TYPE = 'connections';
export const LOCATION_COMPONENT_TYPE = 'location';
export const INVENTORY_COMPONENT_TYPE = 'inventory';
export const PICKUPABLE_COMPONENT_TYPE = 'pickupable';
export const BUTTON_STATE_COMPONENT_TYPE = 'buttonState';
export const PLAYER_COMPONENT_TYPE = 'player';
export const ROOM_COMPONENT_TYPE = 'room';
export const ITEM_COMPONENT_TYPE = 'item';
export const VISIBLE_COMPONENT_TYPE = 'visible';
export const PERCEPTION_COMPONENT_TYPE = 'perception';
export const KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE = 'knownHiddenItems';

export type ComponentType =
  typeof DESCRIPTION_COMPONENT_TYPE |
  typeof CONNECTIONS_COMPONENT_TYPE |
  typeof LOCATION_COMPONENT_TYPE |
  typeof INVENTORY_COMPONENT_TYPE |
  typeof PICKUPABLE_COMPONENT_TYPE |
  typeof BUTTON_STATE_COMPONENT_TYPE |
  typeof PLAYER_COMPONENT_TYPE |
  typeof ROOM_COMPONENT_TYPE |
  typeof ITEM_COMPONENT_TYPE |
  typeof VISIBLE_COMPONENT_TYPE |
  typeof PERCEPTION_COMPONENT_TYPE |
  typeof KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE;
export type RoomId = string;
export type Timestamp = number;
export type VisibilityLevel = 0 | 1 | 2;

export interface IComponent {
  readonly type: ComponentType;
}

export type WorldType = Map<EntityId, Map<ComponentType, IComponent>>

export interface DescriptionComponent extends IComponent { type: typeof DESCRIPTION_COMPONENT_TYPE; name: string; keywords: string[]; text: string; briefDescription?: string; }
export interface RoomConnectionsComponent extends IComponent { type: typeof CONNECTIONS_COMPONENT_TYPE; exits: Record<string, EntityId[]>; }
export interface IsPresentInRoomComponent extends IComponent { type: typeof LOCATION_COMPONENT_TYPE; roomId: EntityId; }
export interface InventoryComponent extends IComponent { type: typeof INVENTORY_COMPONENT_TYPE; items: EntityId[]; }
export interface IsPickupableComponent extends IComponent { type: typeof PICKUPABLE_COMPONENT_TYPE; }
export interface ButtonStateComponent extends IComponent { type: typeof BUTTON_STATE_COMPONENT_TYPE; isPushed: boolean; }
export interface PlayerComponent extends IComponent { type: typeof PLAYER_COMPONENT_TYPE; clientId: string; }
export interface IsRoomComponent extends IComponent { type: typeof ROOM_COMPONENT_TYPE; }
export interface IsItemComponent extends IComponent { type: typeof ITEM_COMPONENT_TYPE; }
export interface IsVisibleComponent extends IComponent { type: typeof VISIBLE_COMPONENT_TYPE; level?: VisibilityLevel }
export interface PerceptionComponent extends IComponent { type: typeof PERCEPTION_COMPONENT_TYPE; sightLevel: VisibilityLevel; }
export interface KnownHiddenItemsComponent extends IComponent { type: typeof KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE; itemIds: EntityId[]; }