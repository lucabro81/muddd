import {
  DescriptionComponent,
  DESCRIPTION_COMPONENT_TYPE,
  getComponent,
  InventoryComponent,
  INVENTORY_COMPONENT_TYPE,
  InventoryCommandEvent,
  WorldType
} from "core/main.js";
import { server } from "../../utils.js";
import { ClientConnection, ClientConnetionMap } from "../types.js";

export const inventoryCommandEventHandler = async (
  event: InventoryCommandEvent,
  worldState: WorldType | null,
  clientConnections: ClientConnetionMap,
) => {
  const { actorId } = event;
  server.log.info(`[InventoryCommand] Received for actor ${actorId}`);

  if (!worldState) return;

  // 1. Find player's connection
  let clientData: ClientConnection | undefined;
  for (const data of clientConnections.values()) {
    if (data.playerId === actorId) {
      clientData = data;
      break;
    }
  }
  if (!clientData) {
    server.log.warn(`[InventoryCommand] Could not find client for actor ${actorId}`);
    return;
  }

  // 2. Get player's inventory
  const inventory = getComponent<InventoryComponent>(worldState, actorId, INVENTORY_COMPONENT_TYPE);
  if (!inventory || inventory.items.length === 0) {
    clientData.connection.send(JSON.stringify({ type: 'text', payload: "Non hai nulla con te." }));
    return;
  }

  // 3. Format the list of items
  const itemNames = inventory.items.map(itemId => {
    if (!worldState) return "un oggetto non identificabile"; // Should not happen, but satisfies TS
    const description = getComponent<DescriptionComponent>(worldState, itemId, DESCRIPTION_COMPONENT_TYPE);
    return description?.name ?? "un oggetto senza nome";
  });

  const message = `Hai con te:\n - ${itemNames.join('\n - ')}`;
  clientData.connection.send(JSON.stringify({ type: 'text', payload: message }));
} 