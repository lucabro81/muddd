// packages/core/src/world-loader.ts
import * as fs from 'fs';
import * as path from 'path';
import {
  WorldType,
  EntityId,
  ComponentType,
  IComponent,
  ROOM_COMPONENT_TYPE,
  IsRoomComponent,
  IsItemComponent,
  ITEM_COMPONENT_TYPE,
  VISIBLE_COMPONENT_TYPE,
  IsVisibleComponent,
  PERCEPTION_COMPONENT_TYPE,
  PerceptionComponent,
  VisibilityLevel,
  KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE,
  KnownHiddenItemsComponent,
  LOCKED_COMPONENT_TYPE,
  LockedComponent
} from '../common/types.js';

// --- IMPORTA TUTTE LE TUE INTERFACCE COMPONENTE SPECIFICHE QUI ---
// Assumendo che siano esportate da un file indice o direttamente
import {
  DescriptionComponent,
  DESCRIPTION_COMPONENT_TYPE,
  RoomConnectionsComponent, CONNECTIONS_COMPONENT_TYPE,
  IsPresentInRoomComponent, LOCATION_COMPONENT_TYPE,
  InventoryComponent, INVENTORY_COMPONENT_TYPE,
  IsPickupableComponent, PICKUPABLE_COMPONENT_TYPE,
  ButtonStateComponent, BUTTON_STATE_COMPONENT_TYPE,
  PlayerComponent, PLAYER_COMPONENT_TYPE,
  SocketComponent,
  SOCKET_COMPONENT_TYPE,
  ExitComponent,
  EXIT_COMPONENT_TYPE,
  // ...importa le altre se necessario
} from '../common/types.js';

// Interfacce helper per la struttura del JSON
interface JsonComponent {
  type: ComponentType;
  [key: string]: any; // Permette altre proprietà
}

interface JsonEntity {
  id: EntityId;
  components: JsonComponent[];
}

interface WorldJson {
  entities: JsonEntity[];
}

type ComponentFactory = (data: any) => IComponent | null;

const componentRegistry: Record<ComponentType, ComponentFactory> = {

  [DESCRIPTION_COMPONENT_TYPE]: (data): DescriptionComponent | null => {
    if (typeof data.name === 'string' && Array.isArray(data.keywords) && typeof data.text === 'string') {
      return {
        ...data,
        type: DESCRIPTION_COMPONENT_TYPE,
      };
    }
    console.error(`Invalid data for DescriptionComponent:`, data);
    return null;
  },

  [CONNECTIONS_COMPONENT_TYPE]: (data): RoomConnectionsComponent | null => {
    // Aggiungi validazione per data.exits se necessario
    return {
      type: CONNECTIONS_COMPONENT_TYPE,
      exits: data.exits || {}, // Fornisci un default se appropriato
    };
  },

  [LOCATION_COMPONENT_TYPE]: (data): IsPresentInRoomComponent | null => {
    if (typeof data.roomId === 'string') {
      return { type: LOCATION_COMPONENT_TYPE, roomId: data.roomId };
    }
    console.error(`Invalid data for IsPresentInRoomComponent:`, data);
    return null;
  },

  [INVENTORY_COMPONENT_TYPE]: (data): InventoryComponent | null => {
    if (Array.isArray(data.items)) {
      return { type: INVENTORY_COMPONENT_TYPE, items: data.items };
    }
    console.error(`Invalid data for InventoryComponent:`, data);
    return null;
  },

  [PICKUPABLE_COMPONENT_TYPE]: (data: any): IsPickupableComponent => {
    return {
      type: PICKUPABLE_COMPONENT_TYPE,
      pickableWhenInstalled: data.pickableWhenInstalled,
    };
  },

  [BUTTON_STATE_COMPONENT_TYPE]: (data): ButtonStateComponent | null => {
    if (typeof data.isPushed === 'boolean') {
      return { type: BUTTON_STATE_COMPONENT_TYPE, isPushed: data.isPushed };
    }
    console.error(`Invalid data for ButtonStateComponent:`, data);
    return null;
  },

  [PLAYER_COMPONENT_TYPE]: (data): PlayerComponent | null => {
    if (typeof data.clientId === 'string') {
      return { type: PLAYER_COMPONENT_TYPE, clientId: data.clientId };
    }
    console.error(`Invalid data for PlayerComponent:`, data);
    return null;
  },

  [ROOM_COMPONENT_TYPE]: (_data): IsRoomComponent => {
    return { type: ROOM_COMPONENT_TYPE };
  },

  [ITEM_COMPONENT_TYPE]: (_data): IsItemComponent => {
    return { type: ITEM_COMPONENT_TYPE };
  },

  [VISIBLE_COMPONENT_TYPE]: (data): IsVisibleComponent | null => {
    if (data.level === undefined || (typeof data.level === 'number' && [0, 1, 2].includes(data.level))) {
      return { type: VISIBLE_COMPONENT_TYPE, level: data.level as VisibilityLevel | undefined };
    }
    console.error(`Invalid data for IsVisibleComponent: level must be 0, 1, or 2. Received:`, data.level);
    return null;
  },

  [PERCEPTION_COMPONENT_TYPE]: (data): PerceptionComponent | null => {
    if (typeof data.sightLevel === 'number' && (data.sightLevel === 0 || data.sightLevel === 1 || data.sightLevel === 2)) { // Assuming VisibilityLevel values
      return { type: PERCEPTION_COMPONENT_TYPE, sightLevel: data.sightLevel as VisibilityLevel };
    }
    console.error(`Invalid data for PerceptionComponent:`, data);
    return null;
  },

  [KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE]: (data): KnownHiddenItemsComponent | null => {
    if (Array.isArray(data.itemIds)) {
      return { type: KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE, itemIds: data.itemIds };
    }
    console.error(`Invalid data for KnownHiddenItemsComponent:`, data);
    return null;
  },

  [SOCKET_COMPONENT_TYPE]: (data): SocketComponent | null => {
    if (
      typeof data.acceptsItemId === 'string' &&
      typeof data.isOccupied === 'boolean' &&
      typeof data.unlocksGateEntityId === 'string' &&
      typeof data.unlocksDirectionOnGate === 'string' &&
      typeof data.socketDescriptionWhenEmpty === 'string' &&
      typeof data.socketDescriptionWhenFilled === 'string'
    ) {
      return {
        ...data,
        type: SOCKET_COMPONENT_TYPE,
      };
    }
    console.error(`Invalid data for SocketComponent:`, data);
    return null;
  },

  [EXIT_COMPONENT_TYPE]: (data): ExitComponent | null => {
    if (
      typeof data.direction === 'string' &&
      typeof data.fromRoomId === 'string' &&
      typeof data.toRoomId === 'string'
    ) {
      return {
        type: EXIT_COMPONENT_TYPE,
        direction: data.direction,
        fromRoomId: data.fromRoomId,
        toRoomId: data.toRoomId,
      };
    }
    console.error(`Invalid data for ExitComponent:`, data);
    return null;
  },

  [LOCKED_COMPONENT_TYPE]: (_data): LockedComponent => {
    return { type: LOCKED_COMPONENT_TYPE };
  },
};

// Funzione principale per caricare lo stato da una stringa JSON
export function loadWorldStateFromJson(jsonContent: string): WorldType {
  let worldData: WorldJson;
  try {
    worldData = JSON.parse(jsonContent);
  } catch (error) {
    console.error("Failed to parse world JSON:", error);
    throw new Error("Invalid world JSON format.");
  }

  const worldState: WorldType = new Map();

  if (!worldData.entities || !Array.isArray(worldData.entities)) {
    throw new Error('Invalid world JSON format: missing or invalid "entities" array.');
  }

  for (const entityData of worldData.entities) {
    const entityId = entityData.id;
    if (!entityId) {
      console.warn('Skipping entity with missing ID:', entityData);
      continue;
    }

    const entityComponents = new Map<ComponentType, IComponent>();
    if (!entityData.components || !Array.isArray(entityData.components)) {
      console.warn(`Entity ${entityId} has missing or invalid "components" array. Skipping components.`);
      // Could decide to create the empty entity or skip it entirely
      worldState.set(entityId, entityComponents); // Add entity even without valid components? To decide.
      continue;
    }

    for (const componentData of entityData.components) {
      const componentType = componentData.type;
      if (!componentType) {
        console.warn(`Skipping component with missing type for entity ${entityId}:`, componentData);
        continue;
      }

      const factory = componentRegistry[componentType];
      if (factory) {
        try {
          // Passa solo i dati rilevanti alla factory, escludendo 'type'
          const { type, ...dataOnly } = componentData;
          const componentInstance = factory(dataOnly);
          if (componentInstance) { // Controlla se la factory ha restituito null (errore validazione)
            entityComponents.set(componentType, componentInstance);
          } else {
            console.warn(`Component factory for type "${componentType}" returned null for entity ${entityId}. Skipping component.`);
          }
        } catch (error) {
          console.error(`Error creating component ${componentType} for entity ${entityId}:`, error);
        }
      } else {
        console.warn(`No factory registered for component type "${componentType}" for entity ${entityId}. Skipping.`);
      }
    }
    worldState.set(entityId, entityComponents);
  }

  console.log(`World state loaded with ${worldState.size} entities.`);
  return worldState;
}

// Funzione helper per caricare da file
export function loadWorldStateFromFile(filePath: string): WorldType {
  try {
    // Risolvi il percorso relativo alla CWD (Current Working Directory)
    const resolvedPath = path.resolve(process.cwd(), filePath);
    console.log(`Attempting to load world state from: ${resolvedPath}`);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found at ${resolvedPath}`);
    }
    const jsonContent = fs.readFileSync(resolvedPath, 'utf-8');
    return loadWorldStateFromJson(jsonContent);
  } catch (error) {
    console.error(`Failed to load world state from file ${filePath}:`, error);
    throw error; // Rilancia l'errore per gestione superiore
  }
}