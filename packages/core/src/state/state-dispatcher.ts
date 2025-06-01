import { gameEventEmitter } from '../events/game-event-emitter.js';
import { ComponentType, CONNECTIONS_COMPONENT_TYPE, EntityId, IComponent, INVENTORY_COMPONENT_TYPE, InventoryComponent, IsItemComponent, IsPresentInRoomComponent, ITEM_COMPONENT_TYPE, LOCATION_COMPONENT_TYPE, RoomConnectionsComponent, RoomId, WorldType } from '../common/types.js';
import { GameEvent, EventType, EntityMoveEvent, LookTargetEvent } from '../events/events.types.js';
import { entityMoveReducer } from './state-reducers.js';
import { v4 as uuidv4 } from 'uuid';
import { findTargetEntity } from '../parser/target-resolver.js';

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

const moveVerbs: Array<string> = [
  'vai', 'go', 'muoviti', 'spostati',
  'n', 's', 'e', 'o', 'w', 'ne', 'no', 'se', 'so', 'u', 'd',
  'up', 'down', 'nord', 'sud', 'est', 'ovest', 'nordest', 'nordovest', 'sudest', 'sudovest', 'su', 'giu'
] as const;

const lookVerbs: Array<string> = [
  'look', 'l', 'guarda', 'esamina', 'examine', 'osserva', 'inspect', 'check', 'ispeziona', 'describe',
  'descrivi'
] as const;

export function getComponent<T extends IComponent>(
  state: WorldType,
  entityId: EntityId,
  componentType: ComponentType
): T | undefined {
  return state.get(entityId)?.get(componentType) as T | undefined;
}

function isAMovingVerb(verb: string): boolean {
  console.log(`[isAMovingVerb] Checking if '${verb}' is a moving verb.`, moveVerbs.includes(verb));
  return moveVerbs.includes(verb);
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
      const argString = event.argString || '';
      console.log(`[applyEvent] Player command event received: ${verb} ${args} ${actorId} ${argString}`);

      if (!verb) {
        console.error(`[applyEvent] Player command event has no verb: ${event}`);
        return currentState;
      }

      if (!moveVerbs.includes(verb) && !lookVerbs.includes(verb)) {
        console.error(`[applyEvent] Invalid verb: ${verb}`);
        return currentState;
      }


      if (lookVerbs.includes(verb)) {
        console.log(`[applyEvent] Look command '${verb}' received.`);
        if (!argString) {
          // If the verb is "look" and there is no argString, we want to describe the room
          // TODO: Emit a LookRoomEvent? Or handle here? For now, ignore.
          console.log(`[applyEvent] Command '${verb}' received without target.`);
          return currentState; // No state changes / no specific event
        }
        // --- Risoluzione Target ---
        console.log(`[applyEvent] Attempting to resolve target '${argString}' for actor ${actorId}`);

        // 1. Find the actor's room
        const location = getComponent<IsPresentInRoomComponent>(currentState, actorId, LOCATION_COMPONENT_TYPE);
        if (!location) return currentState; // Error, actor has no location
        const roomId = location.roomId;

        // 2. Find the entities candidate in the room (objects + other entities)
        const roomInventory = getComponent<InventoryComponent>(currentState, roomId, INVENTORY_COMPONENT_TYPE);
        console.log(`[applyEvent] Room inventory: ${roomInventory?.items.map(item => item).join(', ')}`);

        const itemIds = roomInventory?.items ? [...roomInventory.items] : [];
        console.log(`[applyEvent] ItemIds IDs: ${itemIds.join(', ')}`);

        console.log(`[applyEvent] currentState.keys(): ${Array.from(currentState.keys()).join(', ')}`);

        // Add other players/NPCs in the room (exclude the actor itself)
        const candidateIds: EntityId[] = [];
        itemIds.forEach(entityId => {
          console.log(`[applyEvent] Checking entity ${entityId} in room ${roomId} against actor ${actorId}`, getComponent<IsItemComponent>(currentState, entityId, ITEM_COMPONENT_TYPE));
          if (getComponent<IsItemComponent>(currentState, entityId, ITEM_COMPONENT_TYPE)) {
            const loc = getComponent<IsPresentInRoomComponent>(currentState, entityId, LOCATION_COMPONENT_TYPE);
            if (loc?.roomId === roomId) {
              candidateIds.push(entityId);
            }
          }
        });

        // 3. Implementa la logica di matching (funzione helper?)
        // This function compares argString with name/keywords of the candidates
        const targetEntityId = findTargetEntity(currentState, candidateIds, argString);
        // 4. Emetti evento specifico se il target è valido
        if (targetEntityId) {
          if (targetEntityId === 'ambiguous') {
            console.log(`[applyEvent] Target '${argString}' is ambiguous for ${actorId}.`);
            // TODO: Emit CommandFailed event or send feedback "Which one?"
          } else {
            // Target found! Emit LookTargetEvent
            const lookEvent: LookTargetEvent = {
              id: uuidv4(),
              type: EventType.LOOK_TARGET,
              timestamp: Date.now(),
              actorId: actorId,
              targetEntityId: targetEntityId
            };
            console.log(`[applyEvent] Emitting LookTargetEvent for ${actorId} -> ${targetEntityId}`);
            gameEventEmitter.emit(EventType.LOOK_TARGET, lookEvent);
          }
        } else {
          console.log(`[applyEvent] Target '${argString}' not found for ${actorId} in ${roomId}.`);
          // TODO: Emit CommandFailed event or send feedback "You don't see..."
        }

      }
      else if (isAMovingVerb(verb)) {
        console.log(`[applyEvent] Move command '${verb}' received.`);
        let requestedDirection: string | undefined = undefined;

        requestedDirection = directionAliases[verb];
        if (isThereAValidDirection(args)) {
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