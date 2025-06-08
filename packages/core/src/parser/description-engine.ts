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
  IsPickupableComponent,
  ButtonStateComponent,
  BUTTON_STATE_COMPONENT_TYPE,
  PICKUPABLE_COMPONENT_TYPE,
  PerceptionComponent,
  PERCEPTION_COMPONENT_TYPE,
  VisibilityLevel,
  IsVisibleComponent,
  VISIBLE_COMPONENT_TYPE,
  KnownHiddenItemsComponent,
  KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE,
  ROOM_COMPONENT_TYPE,
  IsRoomComponent,
  IsItemComponent,
  ITEM_COMPONENT_TYPE
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
 * @returns A Promise that resolves with an AsyncIterable of the generated description.
 */
export async function generateRoomDescription(
  provider: LLMProvider,
  worldState: WorldType,
  roomId: EntityId,
  viewerId: EntityId,
  llmModel: string = 'llama3' // Default model
): Promise<AsyncIterable<string>> {

  console.log(`[DescEngine] Preparing stream for room ${roomId}, viewer ${viewerId}, model ${llmModel}`);

  // --- 0. Get Viewer's Perception --- (New Step)
  const viewerPerception = getComponent<PerceptionComponent>(worldState, viewerId, PERCEPTION_COMPONENT_TYPE);
  const viewerSightLevel: VisibilityLevel = viewerPerception?.sightLevel ?? 0;
  const knownHiddenItems = getComponent<KnownHiddenItemsComponent>(worldState, viewerId, KNOWN_HIDDEN_ITEMS_COMPONENT_TYPE)?.itemIds || [];
  console.log(`[DescEngine] Viewer ${viewerId} sight level: ${viewerSightLevel}, known items: ${knownHiddenItems.join(', ')}`);

  // --- 1. Collect Context from the worldState ---

  console.log(`[DescEngine] WorldState: ${JSON.stringify(worldState)}`);

  const roomDesc = getComponent<DescriptionComponent>(worldState, roomId, DESCRIPTION_COMPONENT_TYPE);
  if (!roomDesc) {
    console.error(`[DescEngine] Room ${roomId} has no DescriptionComponent!`);
    async function* errorStream() {
      yield `Sei in un luogo oscuro e indefinito (ID: ${roomId}). Qualcosa è andato storto.`;
    }
    return errorStream();
  }

  const roomInventory = getComponent<InventoryComponent>(worldState, roomId, INVENTORY_COMPONENT_TYPE);

  console.log(`[DescEngine] Room ${roomId} inventory: ${JSON.stringify(roomInventory)}`);

  let itemsString = 'Non vedi oggetti particolari.';
  if (roomInventory && roomInventory.items.length > 0) {
    const visibleItems = roomInventory.items
      .map(itemId => {
        const itemDesc = getComponent<DescriptionComponent>(worldState, itemId, DESCRIPTION_COMPONENT_TYPE);
        const itemVisibility = getComponent<IsVisibleComponent>(worldState, itemId, VISIBLE_COMPONENT_TYPE);
        const itemVisibilityLevel: VisibilityLevel = itemVisibility?.level ?? 0;

        return {
          id: itemId,
          name: itemDesc?.name,
          description: itemDesc?.text, // Full description for potential later use or detailed examination
          briefDescription: itemDesc?.briefDescription, // The new brief description
          visibilityLevel: itemVisibilityLevel
        };
      })
      .filter(item => {
        if (!item.name) return false;
        // Item is visible if its visibility level is low enough OR if the player already knows about it.
        const isKnown = knownHiddenItems.includes(item.id);
        const canBeSeen = viewerSightLevel >= item.visibilityLevel;
        console.log(`[DescEngine] Item ${item.id} is known: ${isKnown} (viewerSightLevel: ${viewerSightLevel}, itemVisibilityLevel: ${item.visibilityLevel})`);
        console.log(`[DescEngine] Item ${item.id} can be seen: ${canBeSeen}`);
        return canBeSeen || isKnown;
      });

    console.log(`[DescEngine] Visible items: ${JSON.stringify(visibleItems)}`);

    if (visibleItems.length > 0) {
      const itemString = visibleItems
        .map((item, index) => `\t${index + 1}. Oggetto: ${item.briefDescription || 'Non descritto brevemente.'}`)
        .join('\n');
      itemsString = `\n${itemString}.`;
    }
  }

  // Other entities (NPCs/Players) in the room (excluding the viewer)
  let otherEntitiesString = '';
  const presentEntityIds = Array.from(worldState.keys()).filter(entityId => {
    const isRoom = getComponent<IsRoomComponent>(worldState, entityId, ROOM_COMPONENT_TYPE);
    const isItem = getComponent<IsItemComponent>(worldState, entityId, ITEM_COMPONENT_TYPE);
    if (entityId === roomId || entityId === viewerId || isRoom || isItem) return false; // Exclude the room itself and the viewer
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
  const roomConnections = getComponent<RoomConnectionsComponent>(worldState, roomId, CONNECTIONS_COMPONENT_TYPE);
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
  const prompt = `Sei un narratore fantasy per un MUD testuale. 
  Il tuo compito è generare la descrizione di una stanza **in seconda persona**, come se parlassi direttamente al giocatore.
  Scrivi in tono conciso ma evocativo, senza diventare piatto.
  ⚠️ Non stai creando narrativa, stai descrivendo **ciò che si vede**. Il tuo stile può evocare atmosfera, ma **non deve mai aggiungere nulla che non sia presente nei dati forniti**.
  ❌ Non inventare MAI oggetti, dettagli architettonici, suoni, odori, luci, creature o passaggi non esplicitamente indicati nei dati.
  ✅ Devi SEMPRE includere **tutti** gli oggetti visibili e **tutte** le uscite visibili nella descrizione finale.

  📏 Ogni descrizione deve:
  1. Restituire l'atmosfera secondo la "Descrizione Base".
  2. Includere in modo naturale ogni oggetto che trovi nella sezione "Oggetti Visibili".
  3. Includere in modo naturale ogni entità presente nella stanza, se esistono.
  4. Terminare sempre includendo in modo naturale un riferimento chiaro alle uscite visibili.
  5. Non fare riferimento al punto di ingresso, a meno che non sia esplicitamente indicato, se indicato includilo in modo naturale nel testo della descirizone.

  Rispondi **solo** con la descrizione della stanza, in prosa coerente.
  
  ---

  ### Dati Stanza
  • **Nome**: ${roomDesc.name}

  • **Descrizione Base**: ${roomDesc.text}

  • **Oggetti Visibili**:
  ${itemsString}

  • **Entità Presenti**:${otherEntitiesString || 'Nessuno.'}

  • **Uscite Visibili**: ${exitsString}

  • **Punto di Ingresso**: ${'Nessuno.'}

  Ricorda: non puoi inventare nulla. Devi includere tutti gli oggetti visibili e tutte le uscite visibili.`;

  console.log(`[DescEngine] Prompt: ${prompt}`);

  // --- 3. Call the LLM Provider ---
  try {
    const generatedDescription = provider.generateText(prompt, llmModel);
    return generatedDescription;
  } catch (error) {
    async function* errorStream() {
      yield `${roomDesc?.name || 'Luogo indefinito'}\n[Errore LLM nell'avvio dello stream]`;
    }
    return errorStream();
  }
}

/**
* Genera la descrizione dettagliata di una specifica entità (oggetto, creatura)
* usando un LLMProvider in streaming.
*
* @param provider L'istanza del provider LLM da usare.
* @param worldState Lo stato attuale del mondo.
* @param targetEntityId L'ID dell'entità da descrivere.
* @param viewerId L'ID dell'entità che sta guardando (per futuro contesto).
* @param llmModel Il nome del modello LLM da usare.
* @returns Una Promise che risolve con un AsyncIterable<string> che produce
* i chunk della descrizione generata.
*/
export async function generateEntityDescriptionStream(
  provider: LLMProvider,
  worldState: WorldType,
  targetEntityId: EntityId,
  viewerId: EntityId, // Per ora non usato attivamente, ma utile per futuro
  llmModel: string = 'llama3'
): Promise<AsyncIterable<string>> {


  // --- 1. Raccogli Contesto dell'Entità Target ---
  const targetDesc = getComponent<DescriptionComponent>(worldState, targetEntityId, DESCRIPTION_COMPONENT_TYPE);

  if (!targetDesc) {
    console.error(`[DescEngine] Entity ${targetEntityId} has no DescriptionComponent! Cannot describe.`);
    async function* errorStream() {
      yield `Non riesci a distinguere bene cosa sia (ID: ${targetEntityId}).`;
    }
    return errorStream();
  }

  let contextDetails: string[] = [];
  contextDetails.push(`Nome: ${targetDesc.name}`);
  contextDetails.push(`Descrizione Base: ${targetDesc.text}`);
  if (targetDesc.keywords && targetDesc.keywords.length > 0) {
    contextDetails.push(`Parole Chiave: ${targetDesc.keywords.join(', ')}`);
  }

  // add details from other relevant components
  const isPickupable = getComponent<IsPickupableComponent>(worldState, targetEntityId, PICKUPABLE_COMPONENT_TYPE);
  if (isPickupable) {
    contextDetails.push("Proprietà: È raccoglibile.");
  }

  // TODO: generalize the pushable state to all entities that can be pushed, not only buttons
  const buttonState = getComponent<ButtonStateComponent>(worldState, targetEntityId, BUTTON_STATE_COMPONENT_TYPE);
  if (buttonState) {
    contextDetails.push(`Stato Bottone: ${buttonState.isPushed ? 'Premuto' : 'Non premuto'}.`);
  }

  const inventory = getComponent<InventoryComponent>(worldState, targetEntityId, INVENTORY_COMPONENT_TYPE);
  if (inventory && inventory.items.length > 0) {
    const itemNames = inventory.items
      .map(itemId => getComponent<DescriptionComponent>(worldState, itemId, DESCRIPTION_COMPONENT_TYPE)?.name)
      .filter((name): name is string => !!name);
    if (itemNames.length > 0) {
      contextDetails.push(`Contiene (visibile): ${itemNames.join(', ')}.`);
    } else {
      contextDetails.push("Contenuto: Sembra vuoto o non riesci a vederne il contenuto.");
    }
  } else if (inventory) { // Esiste il componente inventario ma è vuoto
    contextDetails.push("Contenuto: È vuoto.");
  }

  // TODO: Aggiungere logica per altri componenti (Health, Stats, Material, Condition, Effetti visibili, ecc.)
  // quando verranno definiti e popolati nel world.json o dinamicamente.

  // --- 2. Costruisci il Prompt ---
  // Simile al prompt per la stanza, ma focalizzato sull'entità
  const prompt = `Sei un narratore fantasy per un MUD testuale. 
  Il tuo compito è generare la descrizione di una stanza **in seconda persona**, come se parlassi direttamente al giocatore.
  Scrivi in tono conciso ma evocativo, senza diventare piatto.
  ⚠️ Non stai creando narrativa, stai descrivendo **ciò che si vede**. Il tuo stile può evocare atmosfera, ma **non deve mai aggiungere nulla che non sia presente nei dati forniti**.
  ❌ Non inventare MAI oggetti, dettagli architettonici, suoni, odori, luci, creature o passaggi non esplicitamente indicati nei dati.
    
  --- Istruzioni Output ---
  1. Inizia la descrizione con "Osservi attentamente..." o una frase simile.
  2. Integra tutti i dettagli forniti (Descrizione Base, Parole Chiave se rilevanti, Proprietà, Stato) in una descrizione fluida.
  3. Cita il contenuto se è presente un 'interno' e questo è accessibile ed è noto il modo con cui potervi accedere.
  
  Rispondi **solo** con la descrizione richiesta, in prosa coerente.
  
  ### Dati Entità Esaminata
  ${contextDetails.map(detail => `• ${detail}`).join('\n')}
  
  Ricorda: non puoi inventare nulla, ma solo descrivere in base a quanto è stato fornito.`;

  // --- 3. Call the LLM Provider ---
  try {
    const descriptionStream = provider.generateText(prompt, llmModel);
    return descriptionStream;
  } catch (error) {
    console.error(`[DescEngine] Error initiating entity description stream for ${targetEntityId}:`, error);
    async function* errorStream() {
      yield `${targetDesc?.name || 'Oggetto indefinito'}\n[Errore LLM nell'avvio dello stream per la descrizione dettagliata]`;
    }
    return errorStream();
  }
}