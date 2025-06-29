import { EntityId, EntityMoveEvent, EventType, gameEventEmitter, LookRoomEvent, WorldType } from "core/main.js";
import { server } from "../../utils.js";
import { ClientConnetionMap } from "../types.js";
import { v4 as uuidv4 } from 'uuid';

export const entityMoveEventHandler = (event: EntityMoveEvent, worldState: WorldType | null, clientConnections: ClientConnetionMap) => {
  const playerId = event.entityId;
  const destinationRoomId = event.destinationRoomId;

  // Find the websocket connection for this player
  let clientData: { connection: WebSocket, playerId: EntityId, connectionId: string } | undefined;
  for (const data of clientConnections.values()) {
    if (data.playerId === playerId) {
      clientData = data;
      break;
    }
  }

  if (clientData && worldState) { // Ensure the client is still connected and the state exists
    server.log.info(`Player ${playerId} moved to ${destinationRoomId}. Triggering LookRoomEvent.`);

    // Create and emit a LookRoomEvent
    const lookRoomEvent: LookRoomEvent = {
      id: uuidv4(),
      type: EventType.LOOK_ROOM,
      timestamp: Date.now(),
      actorId: playerId, // The player who moved is the actor looking
      roomId: destinationRoomId, // The room they moved to is the room to look at
    };
    gameEventEmitter.emit(EventType.LOOK_ROOM, lookRoomEvent);
  }
}