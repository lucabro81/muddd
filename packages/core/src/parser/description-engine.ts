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
  ITEM_COMPONENT_TYPE,
  SocketComponent,
  SOCKET_COMPONENT_TYPE,
  ExitComponent,
  EXIT_COMPONENT_TYPE,
  IComponent,
  LOCKED_COMPONENT_TYPE
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
        // Socket-aware description
        const socketAware = getSocketAwareDescription(worldState, itemId);
        // Socket label logic
        const socket = getComponent(worldState, itemId, 'socket') as import('../common/types.js').SocketComponent | undefined;
        let briefDescription = itemDesc?.briefDescription;
        if (socket && socket.isOccupied) {
          briefDescription = (briefDescription ? briefDescription + ' ' : '') + '(al suo posto)';
        }
        return {
          id: itemId,
          name: itemDesc?.name,
          description: socketAware || (itemDesc ? getItemDescriptionByContext(itemDesc, 'room') : undefined),
          briefDescription,
          visibilityLevel: itemVisibilityLevel
        };
      })
      .filter(item => {
        if (!item.name) return false;
        const isKnown = knownHiddenItems.includes(item.id);
        const canBeSeen = viewerSightLevel >= item.visibilityLevel;
        return canBeSeen || isKnown;
      });
    if (visibleItems.length > 0) {
      const itemString = visibleItems
        .map((item, index) => `\t${index + 1}. Oggetto: ${item.briefDescription || 'Non descritto brevemente.'}\n   ${item.description || ''}`)
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
    // New logic: exits are exit entity IDs
    const openExitInfos: string[] = [];
    const lockedExitInfos: string[] = [];

    for (const [, exitEntityIds] of Object.entries(roomConnections.exits)) {
      if (exitEntityIds && exitEntityIds.length > 0) {
        for (const exitEntityId of exitEntityIds) {
          const exitComponent = getComponent<ExitComponent>(worldState, exitEntityId, EXIT_COMPONENT_TYPE);
          const descriptionComponent = getComponent<DescriptionComponent>(worldState, exitEntityId, DESCRIPTION_COMPONENT_TYPE);
          const isLocked = !!getComponent<IComponent>(worldState, exitEntityId, LOCKED_COMPONENT_TYPE);

          // TODO: Add visibility check here based on player's sightLevel
          if (exitComponent) {
            const exitName = descriptionComponent ? `${exitComponent.direction} (${descriptionComponent.name})` : exitComponent.direction;
            if (isLocked) {
              lockedExitInfos.push(exitName);
            } else {
              openExitInfos.push(exitName);
            }
          }
        }
      }
    }

    let openExitsStr = '';
    if (openExitInfos.length > 0) {
      openExitsStr = `\nUscite aperte: ${openExitInfos.join(', ')}.`;
    }

    let lockedExitsStr = '';
    if (lockedExitInfos.length > 0) {
      lockedExitsStr = `\nPassaggi bloccati: ${lockedExitInfos.join(', ')}.`;
    }

    if (openExitsStr || lockedExitsStr) {
      exitsString = `${openExitsStr}${lockedExitsStr}`;
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
* Generates the detailed description of a specific entity (object, creature)
* using an LLMProvider in streaming.
*
* @param provider Provider instance of the LLM to use.
* @param worldState Current state of the world.
* @param targetEntityId ID of the entity to describe.
* @param viewerId ID of the entity that is looking (for future context).
* @param llmModel Name of the LLM model to use.
* @param context Context for the entity description.
* @returns A Promise that resolves with an AsyncIterable<string> that produces
* the chunks of the generated description.
*/
export async function generateEntityDescriptionStream(
  provider: LLMProvider,
  worldState: WorldType,
  targetEntityId: EntityId,
  viewerId: EntityId, // not actually used, but useful for future context
  llmModel: string = 'llama3',
  context: DescriptionContext = 'room'
): Promise<AsyncIterable<string>> {

  console.log(`[DescEngine] Generating entity description stream for ${targetEntityId}, context: ${context}`);


  // --- 1. Raccogli Contesto dell'Entità Target ---
  const targetDesc = getComponent<DescriptionComponent>(worldState, targetEntityId, DESCRIPTION_COMPONENT_TYPE);

  if (!targetDesc) {
    console.error(`[DescEngine] Entity ${targetEntityId} has no DescriptionComponent! Cannot describe.`);
    async function* errorStream() {
      yield `Non riesci a distinguere bene cosa sia (ID: ${targetEntityId}).`;
    }
    return errorStream();
  }

  // Socket-aware description
  const socketAware = getSocketAwareDescription(worldState, targetEntityId);

  console.log(`[DescEngine] Socket-aware description: ${socketAware}`);
  console.log(`[DescEngine] Context details: ${getItemDescriptionByContext(targetDesc, context)}}`);

  let contextDetails: string[] = [];
  contextDetails.push(`Nome: ${targetDesc.name}`);
  contextDetails.push(`Descrizione: ${getItemDescriptionByContext(targetDesc, context)}`);
  socketAware && contextDetails.push(`Descrizione aggiuntiva in base allo stato: ${socketAware}`);
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
  } else if (inventory) { // Inventory component exists but is empty
    contextDetails.push("Contenuto: È vuoto.");
  }

  // TODO: Add logic for other components (Health, Stats, Material, Condition, Visible Effects, etc.)
  // when they are defined and populated in the world.json or dynamically.

  // --- 2. Costruisci il Prompt ---
  // Similar to the room prompt, but focused on the entity
  const prompt = `Sei un narratore fantasy per un MUD testuale. 
  Il tuo compito è generare la descrizione di una stanza **in seconda persona**, come se parlassi direttamente al giocatore.
  Scrivi in tono conciso ma evocativo, senza diventare piatto.
  ⚠️ Non stai creando narrativa, stai descrivendo **ciò che si vede**. Il tuo stile può evocare atmosfera, ma **non deve mai aggiungere nulla che non sia presente nei dati forniti**.
  ❌ Non inventare MAI oggetti, dettagli architettonici, suoni, odori, luci, creature o passaggi non esplicitamente indicati nei dati.
    
  --- Istruzioni Output ---
  1. Inizia la descrizione con "Osservi attentamente..." o una frase simile.
  2. Integra tutti i dettagli forniti (Descrizione, Parole Chiave se rilevanti, Proprietà, Stato) in una descrizione fluida.
  3. Cita il contenuto se è presente un 'interno' e questo è accessibile ed è noto il modo con cui potervi accedere.
  
  Rispondi **solo** con la descrizione richiesta, in prosa coerente.
  
  ### Dati Entità Esaminata
  ${contextDetails.map(detail => `• ${detail}`).join('\n')}
  
  Ricorda: non puoi inventare nulla, ma solo descrivere in base a quanto è stato fornito.`;

  console.log(`[DescEngine] Prompt: ${prompt}`);

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

type DescriptionContext = 'inventory' | 'room' | 'installed' | 'examination';
function getItemDescriptionByContext(desc: DescriptionComponent, context: DescriptionContext): string {
  if (context === 'examination') return desc.text;
  if (context === 'inventory' && desc.descriptionInInventory) return desc.descriptionInInventory;
  if (context === 'room' && desc.descriptionInRoom) return desc.descriptionInRoom;
  if (context === 'installed' && desc.descriptionInstalled) return desc.descriptionInstalled;
  return desc.text;
}

function getSocketAwareDescription(worldState: WorldType, entityId: EntityId): string | undefined {
  const socket = getComponent(worldState, entityId, SOCKET_COMPONENT_TYPE) as SocketComponent | undefined;
  if (socket) {
    return socket.isOccupied ? socket.socketDescriptionWhenFilled : socket.socketDescriptionWhenEmpty;
  }
  return undefined;
}