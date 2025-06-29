import { StateUpdatedEvent, WorldType } from "core/main.js";
import { server } from "../utils.js";

export const stateUpdatedEventHandler = (event: StateUpdatedEvent, worldState: WorldType | null) => {
  server.log.info(`[gameEventEmitter] World state updated. New state has ${event.newState.size} entities.`);
  worldState = event.newState;
}