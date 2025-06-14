import { v4 as uuidv4 } from 'uuid';
import { EntityId } from '../common/types.js';
import {
  EventType,
  GameEvent,
  InventoryCommandEvent,
  PickupCommandEvent,
  PlayerCommandEvent,
  PutCommandEvent,
  SearchCommandEvent,
  ExamineCommandEvent
} from '../events/events.types.js';

// Define known verbs
const searchVerbs: string[] = ['search', 'cerca', 'esplora', 'perquisisci', 'explore'];
const pickupVerbs: string[] = ['pick', 'prendi', 'raccogli', 'take', 'get'];
const inventoryVerbs: string[] = ['inventory', 'inventario', 'inv', 'i'];
const putVerbs: string[] = ['put', 'metti', 'inserisci', 'place'];
const examineVerbs: string[] = ['examine', 'esamina', 'inspect', 'guarda', 'osserva', 'analizza'];

/* TBD: Add other context variables as needed */
export interface CommandParserContext {
  actorId: EntityId;
}

export function parseCommand(rawInput: string, context: CommandParserContext): GameEvent | null {
  const trimmedInput = rawInput.trim();
  if (trimmedInput === '') {
    return null;
  }

  const lowerCasedInput = trimmedInput.toLowerCase();
  const words = lowerCasedInput.split(/\s+/);

  const verb = words[0];
  const args = words.slice(1);
  const argString = args.join(' ');

  // Command-specific event generation
  if (searchVerbs.includes(verb)) {
    const searchEvent: SearchCommandEvent = {
      id: uuidv4(),
      type: EventType.SEARCH_COMMAND,
      timestamp: Date.now(),
      actorId: context.actorId,
      // For now, search has no arguments and applies to the room
      // so we will need to resolve the roomId in the event handler.
    };
    console.log('[parseCommand] Parsed as SearchCommandEvent:', searchEvent);
    return searchEvent;
  }

  if (pickupVerbs.includes(verb)) {
    if (argString.length === 0) {
      // In a real game, you might want a more specific "What do you want to pick up?" event.
      // For now, we can return null or a generic error event.
      return null;
    }
    const pickupEvent: PickupCommandEvent = {
      id: uuidv4(),
      type: EventType.PICKUP_COMMAND,
      timestamp: Date.now(),
      actorId: context.actorId,
      targetKeywords: argString,
    };
    console.log('[parseCommand] Parsed as PickupCommandEvent:', pickupEvent);
    return pickupEvent;
  }

  if (inventoryVerbs.includes(verb)) {
    const inventoryEvent: InventoryCommandEvent = {
      id: uuidv4(),
      type: EventType.INVENTORY_COMMAND,
      timestamp: Date.now(),
      actorId: context.actorId,
    };
    console.log('[parseCommand] Parsed as InventoryCommandEvent:', inventoryEvent);
    return inventoryEvent;
  }

  if (putVerbs.includes(verb)) {
    // This command has the structure "put <item> in <target>"
    const inIndex = argString.indexOf(' in ');

    if (inIndex === -1) {
      // "in" separator not found, invalid command format
      return null;
    }

    const itemKeywords = argString.substring(0, inIndex).trim();
    const targetKeywords = argString.substring(inIndex + 4).trim();

    if (itemKeywords.length === 0 || targetKeywords.length === 0) {
      // Both item and target must be specified
      return null;
    }

    const putEvent: PutCommandEvent = {
      id: uuidv4(),
      type: EventType.PUT_COMMAND,
      timestamp: Date.now(),
      actorId: context.actorId,
      itemKeywords: itemKeywords,
      targetKeywords: targetKeywords,
    };
    console.log('[parseCommand] Parsed as PutCommandEvent:', putEvent);
    return putEvent;
  }

  if (examineVerbs.includes(verb)) {
    if (argString.length === 0) {
      return null;
    }
    const examineEvent: ExamineCommandEvent = {
      id: uuidv4(),
      type: EventType.EXAMINE_COMMAND,
      timestamp: Date.now(),
      actorId: context.actorId,
      targetKeywords: argString,
    };
    console.log('[parseCommand] Parsed as ExamineCommandEvent:', examineEvent);
    return examineEvent;
  }

  // Default to a generic PlayerCommandEvent
  const commandEvent: PlayerCommandEvent = {
    id: uuidv4(),
    type: EventType.PLAYER_COMMAND,
    timestamp: Date.now(),
    entityId: context.actorId,
    rawInput: trimmedInput,
    verb,
    args,
    argString,
  };

  // TODO: Implement command parsing logic here
  // For now, just return the event as is
  console.log('[parseCommand] Parsed command:', commandEvent);
  return commandEvent;
}