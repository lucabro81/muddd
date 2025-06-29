import { EntityMoveEvent, EventType, gameEventEmitter, LookRoomEvent, WorldType } from "core/main.js";
import { v4 as uuidv4 } from 'uuid';
import { connectionsClientData, server } from "../../utils.js";

export const entityMoveEventHandler = (event: EntityMoveEvent, worldState: WorldType | null) => {
  const playerId = event.entityId;
  const destinationRoomId = event.destinationRoomId;

  const clientData = connectionsClientData(playerId);

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