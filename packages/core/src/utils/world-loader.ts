// packages/core/src/world-loader.ts
import * as fs from 'fs';
import * as path from 'path';
import { WorldType, EntityId, ComponentType, IComponent } from '../common/types.js';

// --- IMPORTA TUTTE LE TUE INTERFACCE COMPONENTE SPECIFICHE QUI ---
// Assumendo che siano esportate da un file indice o direttamente
import {
  DescriptionComponent, DESCRIPTION_COMPONENT_TYPE,
  RoomConnectionsComponent, CONNECTIONS_COMPONENT_TYPE,
  IsPresentInRoomComponent, LOCATION_COMPONENT_TYPE,
  InventoryComponent, INVENTORY_COMPONENT_TYPE,
  IsPickupableComponent, PICKUPABLE_COMPONENT_TYPE,
  ButtonStateComponent, BUTTON_STATE_COMPONENT_TYPE,
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

// Tipo per le funzioni factory che creano componenti
type ComponentFactory = (data: any) => IComponent | null;

// --- REGISTRO DEI COMPONENTI: Mappa i tipi stringa a funzioni factory ---
// !!! QUESTA È LA PARTE CHIAVE DA COMPLETARE !!!
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

  [PICKUPABLE_COMPONENT_TYPE]: (_data): IsPickupableComponent => {
    // Componente marker, non ha dati specifici da validare qui
    return { type: PICKUPABLE_COMPONENT_TYPE };
  },

  [BUTTON_STATE_COMPONENT_TYPE]: (data): ButtonStateComponent | null => {
    if (typeof data.isPushed === 'boolean') {
      return { type: BUTTON_STATE_COMPONENT_TYPE, isPushed: data.isPushed };
    }
    console.error(`Invalid data for ButtonStateComponent:`, data);
    return null;
  },

  // Aggiungi qui le factory per *tutti* gli altri tipi di componente che definirai!

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