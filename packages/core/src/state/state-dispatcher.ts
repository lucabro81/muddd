import { gameEventEmitter } from '../events/game-event-emitter.js';
import { ComponentType, CONNECTIONS_COMPONENT_TYPE, EntityId, IComponent, IsPresentInRoomComponent, LOCATION_COMPONENT_TYPE, RoomConnectionsComponent, RoomId, WorldType } from '../common/types.js';
import { GameEvent, EventType, EntityMoveEvent } from '../events/events.types.js';
import { entityMoveReducer } from './state-reducers.js';
import { v4 as uuidv4 } from 'uuid';

const directionAliases: Record<string, string> = {
  n: 'nord',
  s: 'sud',
  e: 'est',
  o: 'ovest',
  w: 'ovest',
  ne: 'nordest',
  no: 'nordovest',
  se: 'sudest',
  so: 'sudovest',
  u: 'su',
  up: 'su',
  d: 'giu',
  down: 'giu',

  nord: 'nord',
  sud: 'sud',
  est: 'est',
  ovest: 'ovest',
  nordest: 'nordest',
  nordovest: 'nordovest',
  sudest: 'sudest',
  sudovest: 'sudovest',
  su: 'su',
  giu: 'giu',
} as const;

export function getComponent<T extends IComponent>(
  state: WorldType,
  entityId: EntityId,
  componentType: ComponentType
): T | undefined {
  return state.get(entityId)?.get(componentType) as T | undefined;
}

function isVerbADirection(verb: string): boolean {
  return directionAliases[verb] !== undefined;
}

function isThereAValidDirection(args: string[]): boolean {
  return args.length > 0 && directionAliases[args[0]] !== undefined;
}

function getLocationId(currentState: WorldType, actorId: EntityId): RoomId | undefined {
  const locationComponent = getComponent<IsPresentInRoomComponent>(currentState, actorId, LOCATION_COMPONENT_TYPE);
  if (!locationComponent) {
    console.error(`[applyEvent] Unable to find the location for the actor ${actorId}`);
    // TODO: Feedback error to the player?
    return undefined;
  }
  return locationComponent.roomId;
}

/**
 * Central function to apply an event to the world state.
 * Determines the appropriate reducer based on the event type
 * and returns the new world state.
 * Operates in an immutable way.
 *
 * @param currentState The current world state.
 * @param event The game event to apply.
 * @returns The new world state after applying the event.
 */
export function applyEvent(currentState: WorldType, event: GameEvent): WorldType {

  console.log(`[applyEvent] Applying event: ${event.type}`);

  switch (event.type) {
    case EventType.ENTITY_MOVE:
      return entityMoveReducer(currentState, event);
    case EventType.PLAYER_COMMAND:
      const verb = event.verb?.toLowerCase();
      const args = event.args || [];
      const actorId = event.entityId;

      const moveVerbs = [
        'vai', 'go', 'muoviti', 'spostati',
        'n', 's', 'e', 'o', 'w', 'ne', 'no', 'se', 'so', 'u', 'd',
        'up', 'down', 'nord', 'sud', 'est', 'ovest', 'nordest', 'nordovest', 'sudest', 'sudovest', 'su', 'giu'];

      if (!verb) {
        console.error(`[applyEvent] Player command event has no verb: ${event}`);
        return currentState;
      }

      if (!moveVerbs.includes(verb)) {
        console.error(`[applyEvent] Invalid verb: ${verb}`);
        return currentState;
      }

      let requestedDirection: string | undefined = undefined;

      // Se il verbo è già una direzione (es. 'n', 'nord'), quella è la direzione
      if (isVerbADirection(verb)) {
        requestedDirection = directionAliases[verb];
      }
      else if (isThereAValidDirection(args)) {
        requestedDirection = directionAliases[args[0]];
      }
      else {
        console.log(`[applyEvent] Command '${verb}' received but direction '${args[0]}' not recognized.`);
        // TODO: Send feedback to the player "Where do you want to go?" or "You can't go there"
        return currentState;
      }

      if (requestedDirection) {
        const originRoomId = getLocationId(currentState, actorId);
        if (!originRoomId) {
          return currentState; // No state changes
        }

        const connectionsComponent = getComponent<RoomConnectionsComponent>(currentState, originRoomId, CONNECTIONS_COMPONENT_TYPE);
        if (!connectionsComponent?.exits) {
          console.log(`[applyEvent] The room ${originRoomId} has no exits defined.`);
          // TODO: Feedback to the player "You can't go in that direction."
          return currentState; // No state changes
        }

        const possibleDestinations = connectionsComponent.exits[requestedDirection];
        if (possibleDestinations && possibleDestinations.length > 0) {
          //TODO: Simple for now: take the first valid destination
          const destinationRoomId = possibleDestinations[0];

          const moveEvent: EntityMoveEvent = {
            id: uuidv4(),
            type: EventType.ENTITY_MOVE,
            timestamp: Date.now(),
            entityId: actorId,
            originRoomId: originRoomId,
            destinationRoomId: destinationRoomId,
          };
          console.log(`[applyEvent] Emitting EntityMoveEvent for player ${actorId} to ${destinationRoomId}`);
          gameEventEmitter.emit(EventType.ENTITY_MOVE, moveEvent);

        }
        else {
          console.log(`[applyEvent] No exit towards ${requestedDirection} from room ${originRoomId}.`);
          // TODO: Send feedback to the player "You can't go in that direction."
          return currentState; // No state changes
        }


      }

      // IMPORTANT: The handling of the PlayerCommand itself does not modify the state.
      // It simply interprets and potentially emits a more specific event.
      // The state modification will occur when the specific event (e.g. EntityMoveEvent)
      // is processed in the next cycle by this same switch.

      console.log(`[applyEvent] Current state after processing player command: ${currentState.size} entities.`);

      return currentState;

    default:
      // If the event is not recognized or does not cause state changes,
      // returns the current state without modifications.
      console.log(`[applyEvent] No state reducer registered for event type: ${(event as GameEvent).type}`);
      return currentState;
  }
}