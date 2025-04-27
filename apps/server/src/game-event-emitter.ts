import { server } from "./utils.js";
import { type WorldType, gameEventEmitter, type GameEvent, applyEvent } from "core/main.js"

const setGameEventEmitter = (worldState: WorldType | null) => {
  gameEventEmitter.on('*', (event: GameEvent) => {
    if (!worldState || !event?.type) return;
    try {
      worldState = applyEvent(worldState, event);
      // console.log(`World state potentially updated after event ${event.type}.`);
      // TODO: Notificare client dei cambiamenti rilevanti
    } catch (error) {
      server.log.error({ err: error, event }, `Error applying event type ${event.type}`);
    }
  });
}

export { setGameEventEmitter };