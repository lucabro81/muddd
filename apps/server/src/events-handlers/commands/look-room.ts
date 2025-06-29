import { generateRoomDescription, LookRoomEvent, OllamaProvider, WorldType } from "core/main.js";
import { ClientConnection, ClientConnetionMap } from "../types.js";
import { server } from "../../utils.js";

export const lookRoomEventHandler = async (
  event: LookRoomEvent,
  worldState: WorldType | null,
  clientConnections: ClientConnetionMap,
  llmProvider: OllamaProvider,
  llmModel: string,
) => {
  const { actorId, roomId } = event;
  let clientData: ClientConnection | undefined;
  for (const data of clientConnections.values()) {
    if (data.playerId === actorId) {
      clientData = data;
      break;
    }
  }

  if (clientData && worldState) {
    server.log.info(`Player ${actorId} is looking at room ${roomId}. Generating description stream...`);
    try {
      const descriptionStream = await generateRoomDescription(
        llmProvider, worldState, roomId, actorId, llmModel
      );

      if (!clientConnections.has(clientData.connectionId)) {
        server.log.warn(`Client ${actorId} disconnected while streaming room description for ${roomId}.`);
        return;
      }

      clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));

      for await (const chunk of descriptionStream) {
        if (clientConnections.has(clientData.connectionId)) {
          clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: chunk }));
        } else {
          server.log.warn(`Client ${actorId} disconnected during room description stream for ${roomId}.`);
          break; // Stop streaming if client disconnects
        }
      }

      if (clientConnections.has(clientData.connectionId)) {
        clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));
      }
      server.log.info(`Finished streaming room description to ${actorId} for room ${roomId}.`);

    } catch (error) {
      server.log.error({ err: error, target: roomId, actor: actorId }, "Failed to generate or send room description");
      if (clientConnections.has(clientData.connectionId)) {
        clientData.connection.send(JSON.stringify({ type: 'error', payload: "\n[An error occurred while describing this place.]\n" }));
      }
    }
  }
}