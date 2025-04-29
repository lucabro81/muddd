export type EntityId = string;

export const DESCRIPTION_COMPONENT_TYPE = 'description';
export const CONNECTIONS_COMPONENT_TYPE = 'connections';
export const LOCATION_COMPONENT_TYPE = 'location';
export const INVENTORY_COMPONENT_TYPE = 'inventory';
export const PICKUPABLE_COMPONENT_TYPE = 'pickupable';
export const BUTTON_STATE_COMPONENT_TYPE = 'buttonState';
export const PLAYER_COMPONENT_TYPE = 'player';

export type ComponentType =
  typeof DESCRIPTION_COMPONENT_TYPE |
  typeof CONNECTIONS_COMPONENT_TYPE |
  typeof LOCATION_COMPONENT_TYPE |
  typeof INVENTORY_COMPONENT_TYPE |
  typeof PICKUPABLE_COMPONENT_TYPE |
  typeof BUTTON_STATE_COMPONENT_TYPE |
  typeof PLAYER_COMPONENT_TYPE;
export type RoomId = string;
export type Timestamp = number;

export interface IComponent {
  readonly type: ComponentType;
}

export type WorldType = Map<EntityId, Map<ComponentType, IComponent>>

export interface DescriptionComponent extends IComponent { type: typeof DESCRIPTION_COMPONENT_TYPE; name: string; keywords: string[]; text: string; }
export interface RoomConnectionsComponent extends IComponent { type: typeof CONNECTIONS_COMPONENT_TYPE; exits: Record<string, EntityId[]>; }
export interface IsPresentInRoomComponent extends IComponent { type: typeof LOCATION_COMPONENT_TYPE; roomId: EntityId; }
export interface InventoryComponent extends IComponent { type: typeof INVENTORY_COMPONENT_TYPE; items: EntityId[]; }
export interface IsPickupableComponent extends IComponent { type: typeof PICKUPABLE_COMPONENT_TYPE; }
export interface ButtonStateComponent extends IComponent { type: typeof BUTTON_STATE_COMPONENT_TYPE; isPushed: boolean; }
export interface PlayerComponent extends IComponent { type: typeof PLAYER_COMPONENT_TYPE; clientId: string; }