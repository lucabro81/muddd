import { v4 as uuidv4 } from 'uuid';
import { EntityId } from '../common/types.js';
import { EventType, GameEvent, PlayerCommandEvent, SearchCommandEvent } from '../events/events.types.js';

// Define known verbs
const searchVerbs: string[] = ['search', 'cerca', 'esplora', 'examine', 'perquisisci', 'explore'];

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