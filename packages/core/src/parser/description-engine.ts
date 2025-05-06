import {
  DESCRIPTION_COMPONENT_TYPE,
  CONNECTIONS_COMPONENT_TYPE,
  INVENTORY_COMPONENT_TYPE,
  LOCATION_COMPONENT_TYPE,
  EntityId,
  WorldType,
  DescriptionComponent,
  RoomConnectionsComponent,
  InventoryComponent,
  IsPresentInRoomComponent,
} from "../common/types.js"
import { getComponent } from "../state/state-dispatcher.js"
import { LLMProvider } from "./ollama-provider.js";

/**
 * Generates the description of a room using a LLMProvider.
 *
 * @param provider The instance of the LLMProvider to use (e.g. OllamaProvider).
 * @param worldState The current state of the world.
 * @param roomId The ID of the room to describe.
 * @param viewerId The ID of the entity that is looking (to exclude it from the list of present entities).
 * @param llmModel The name of the LLM model to use (e.g. 'llama3').
 * @returns A Promise that resolves with the generated description.
 */
export async function generateRoomDescription(
  provider: LLMProvider,
  worldState: WorldType,
  roomId: EntityId,
  viewerId: EntityId,
  llmModel: string = 'llama3' // Default model
): Promise<string> {

  console.log(`[DescEngine] Generating description for room ${roomId}, viewer ${viewerId}`);

  // --- 1. Collect Context from the worldState ---
  const roomDesc = getComponent<DescriptionComponent>(worldState, roomId, DESCRIPTION_COMPONENT_TYPE);
  const roomConnections = getComponent<RoomConnectionsComponent>(worldState, roomId, CONNECTIONS_COMPONENT_TYPE);
  const roomInventory = getComponent<InventoryComponent>(worldState, roomId, INVENTORY_COMPONENT_TYPE);

  if (!roomDesc) {
    console.error(`[DescEngine] Room ${roomId} has no DescriptionComponent!`);
    return `Sei in un luogo indefinito (ID: ${roomId}). Qualcosa è andato storto.`;
  }

  // Items in the room
  let itemsString = 'Non vedi oggetti particolari.';
  if (roomInventory && roomInventory.items.length > 0) {
    const itemNames = roomInventory.items
      .map(itemId => getComponent<DescriptionComponent>(worldState, itemId, DESCRIPTION_COMPONENT_TYPE)?.name)
      .filter(name => !!name); // Filtra eventuali oggetti senza nome/descrizione
    if (itemNames.length > 0) {
      itemsString = `Vedi qui: ${itemNames.join(', ')}.`;
    }
  }

  // Other entities (NPCs/Players) in the room (excluding the viewer)
  let otherEntitiesString = '';
  const presentEntityIds = Array.from(worldState.keys()).filter(entityId => {
    if (entityId === roomId || entityId === viewerId) return false; // Exclude the room itself and the viewer
    const loc = getComponent<IsPresentInRoomComponent>(worldState, entityId, LOCATION_COMPONENT_TYPE);
    return loc?.roomId === roomId;
  });
  if (presentEntityIds.length > 0) {
    const entityNames = presentEntityIds
      .map(entityId => getComponent<DescriptionComponent>(worldState, entityId, DESCRIPTION_COMPONENT_TYPE)?.name)
      .filter(name => !!name);
    if (entityNames.length > 0) {
      otherEntitiesString = `Sono presenti anche: ${entityNames.join(', ')}.`;
    }
  }


  // Exits
  let exitsString = 'Non vedi uscite evidenti.';
  if (roomConnections && roomConnections.exits) {
    const availableExits = Object.entries(roomConnections.exits)
      .filter(([, destinationIds]) => destinationIds && destinationIds.length > 0)
      .map(([direction]) => direction);
    if (availableExits.length > 0) {
      exitsString = `Le uscite ovvie sono: ${availableExits.join(', ')}.`;
    }
  }

  // TODO: Add context from active effects in the room or the player? Recent events?

  // --- 2. Build the Prompt ---
  // This is a VERY BASIC example, it will be iterated!
  const prompt = `Sei un narratore per un gioco MUD testuale fantasy. Descrivi la seguente stanza in seconda persona singolare ('tu sei', 'tu vedi'). Sii evocativo ma conciso (massimo 60 parole).
Nome Stanza: ${roomDesc.name}
Descrizione Base: ${roomDesc.text}
Oggetti Presenti: ${itemsString}
Altre Creature/Persone Presenti: ${otherEntitiesString || 'Nessuno.'}
Uscite: ${exitsString}

Descrivi la scena attuale:`;

  console.log(`[DescEngine] Built prompt (length ${prompt.length}):\n--- PROMPT START ---\n${prompt}\n--- PROMPT END ---`);


  // --- 3. Call the LLM Provider ---
  try {
    const generatedDescription = await provider.generateText(prompt, llmModel);
    console.log(`[DescEngine] Generated description (length ${generatedDescription.length})`);
    return generatedDescription;
  } catch (error) {
    console.error(`[DescEngine] Failed to generate description for room ${roomId}:`, error);
    // Fallback to a basic description in case of LLM error
    return `${roomDesc.name}\n${roomDesc.text}\n${itemsString}\n${otherEntitiesString}\n${exitsString}\n[Error in detailed description generation]`;
  }
}