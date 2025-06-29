import { CommandFailedEvent, CommandFailureReason, WorldType } from "core/main.js";
import { connectionsClientData, server } from "../utils.js";

export const commandFailedEventHandler = async (event: CommandFailedEvent,
  worldState: WorldType | null,
) => {
  const { actorId, reason } = event;
  server.log.info(`[CommandFailed] Received for actor ${actorId} with reason "${reason}"`);

  if (!worldState) return;

  let clientData = connectionsClientData(actorId);

  if (!clientData) {
    server.log.warn(`[CommandFailed] Could not find client for actor ${actorId}`);
    return;
  }

  let message = "Comando non riuscito."; // Default message
  switch (reason) {
    case CommandFailureReason.EXIT_LOCKED:
      message = "La via è bloccata, non puoi procedere.";
      break;
    // TODO: Add other failure reasons here
  }

  clientData.connection.send(JSON.stringify({ type: 'text', payload: message }));
}