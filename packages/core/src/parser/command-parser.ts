import { v4 as uuidv4 } from 'uuid';
import { EntityId } from '../common/types.js';
import { EventType, PlayerCommandEvent } from '../events/events.types.js';

/* TBD: Add other context variables as needed */
export interface CommandParserContext {
  actorId: EntityId;
}

export function parseCommand(rawInput: string, context: CommandParserContext): PlayerCommandEvent | null {
  const trimmedInput = rawInput.trim();
  if (trimmedInput === '') {
    return null;
  }

  const lowerCasedInput = trimmedInput.toLowerCase();
  const words = lowerCasedInput.split(/\s+/);

  const verb = words[0];
  const args = words.slice(1);
  const argString = args.join(' ');

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