import { generateEntityDescriptionStream, getComponent, INVENTORY_COMPONENT_TYPE, InventoryComponent, LookTargetEvent, OllamaProvider, WorldType } from "core/main.js";
import { ClientConnection, ClientConnetionMap } from "../types.js";
import { connectionsClientData, server } from "../../utils.js";

export const lookTargetEventHandler = async (
  event: LookTargetEvent,
  worldState: WorldType | null,
  clientConnections: ClientConnetionMap,
  llmProvider: OllamaProvider,
  llmModel: string,
) => {
  const { actorId, targetEntityId } = event;
  const clientData = connectionsClientData(actorId);

  if (clientData && worldState) {
    server.log.info(`Player ${actorId} is looking at ${targetEntityId}. Generating description stream...`);
    try {

      const inventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
      const isInInventory = inventory && inventory.items.includes(targetEntityId)

      const descriptionStream = await generateEntityDescriptionStream(
        llmProvider, worldState, targetEntityId, actorId, llmModel
      );
      // Send the stream to the client as we did for the room description
      clientData.connection.send('\n'); // Separator
      let isInInventoryAdded = false;
      for await (const chunk of descriptionStream) {
        if (isInInventory && !isInInventoryAdded) {
          clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: '[Inventario]\n' }));
          isInInventoryAdded = true;
        }
        if (clientConnections.has(clientData.connectionId)) { // Use the correct key here! e.g. clientData.clientId or req.id
          clientData.connection.send(JSON.stringify({ type: 'stream_chunk', payload: `${chunk}` }));
        } else { break; }
      }
      if (clientConnections.has(clientData.connectionId)) {
        clientData.connection.send(JSON.stringify({ type: 'text', payload: '\n' }));
      }
      server.log.info(`Finished streaming entity description to ${actorId}.`);
    } catch (error) {
      server.log.error({ err: error, target: targetEntityId }, "Failed to generate or send entity description");
      if (clientConnections.has(clientData.connectionId)) {
        clientData.connection.send(JSON.stringify({ type: 'error', payload: "\n[Errore nella descrizione dell'oggetto.]\n" }));
      }
    }
  }
}