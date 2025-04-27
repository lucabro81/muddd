import { server } from "./utils.js";
import { type WorldType } from "core/common/types.js";
import { gameEventEmitter } from "core/events/game-event-emitter.js";
import { type GameEvent } from "core/events/events.types.js";
import { applyEvent } from "core/state/state-dispatcher.js";

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