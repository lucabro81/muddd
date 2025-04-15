export type EntityId = string;
export type ComponentType = 'description' | 'connections' | 'location' | 'inventory' | 'pickupable' | 'buttonState';
export type RoomId = string;
export type Timestamp = number;

export interface IComponent {
  readonly type: ComponentType;
}

export type WorldType = Map<EntityId, Map<ComponentType, IComponent>>

export interface DescriptionComponent extends IComponent { type: 'description'; name: string; keywords: string[]; text: string; }
export interface RoomConnectionsComponent extends IComponent { type: 'connections'; exits: Record<string, EntityId[]>; }
export interface IsPresentInRoomComponent extends IComponent { type: 'location'; roomId: EntityId; }
export interface InventoryComponent extends IComponent { type: 'inventory'; items: EntityId[]; } // Per oggetti nella stanza o nell'inventario PG
export interface IsPickupableComponent extends IComponent { type: 'pickupable'; } // Componente "marker"
export interface ButtonStateComponent extends IComponent { type: 'buttonState'; isPushed: boolean; }