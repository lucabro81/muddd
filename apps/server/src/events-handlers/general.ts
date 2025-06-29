import { EventType, GameEvent, processEvent, WorldType } from "core/main.js";
import { server } from "./../utils.js";

export const generalEventHandler = (event: GameEvent, worldState: WorldType | null) => {
  server.log.info(`[gameEventEmitter] Processing event: ${event.type}`);
  if (!worldState || !event?.type || event.type === EventType.STATE_UPDATED) {
    // Ignore state updates to prevent loops
    return;
  }

  try {
    processEvent(worldState, event);
  } catch (error) {
    server.log.error({ err: error, event }, `Error processing event type ${event.type}`);
  }
}