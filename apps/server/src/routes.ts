import { WebSocket } from "@fastify/websocket";
import { type FastifyInstance, type FastifyRequest } from "fastify";
import { type WorldType, gameEventEmitter, parseCommand, CommandParserContext, ComponentType, IComponent, DESCRIPTION_COMPONENT_TYPE, DescriptionComponent, IsPresentInRoomComponent, LOCATION_COMPONENT_TYPE, EntityId, INVENTORY_COMPONENT_TYPE, InventoryComponent } from "core/main.js"
import { v4 as uuidv4 } from 'uuid';

const clientConnections = new Map<string, { connection: WebSocket, playerId: EntityId }>();
const STARTING_ROOM_ID: EntityId = 'room_entrance';

export function routes(server: FastifyInstance, worldState: WorldType | null) {

  if (!worldState) {
    throw new Error('World state is not loaded');
  }

  server.get('/status', async (_request, reply) => {
    return reply.send({
      status: 'running',
      worldEntitiesLoaded: worldState?.size ?? 0,
      timestamp: new Date().toISOString(),
    });
  });

  server.get('/ws', { websocket: true }, (connection: WebSocket, req: FastifyRequest) => {
    server.log.info('>>> Entered /ws handler');
    const connectionId = req.id; // ID univoco per questa connessione WebSocket
    server.log.info(`Client ${connectionId} connecting from ${req.ip}...`);

    if (!worldState) {
      server.log.error("World state is not initialized. Cannot add player.");
      connection.send("ERROR: Server world state not ready.");
      connection.close();
      return;
    }

    const playerId = `player_${uuidv4().substring(0, 8)}`;
    server.log.info(`Assigning Entity ID ${playerId} to connection ${connectionId}`);

    const playerComponents = new Map<ComponentType, IComponent>();

    const description: DescriptionComponent = {
      type: DESCRIPTION_COMPONENT_TYPE,
      name: `Giocatore ${playerId}`,
      keywords: ['giocatore', 'tu', 'me'],
      text: 'Sei un avventuriero dall\'aria determinata.',
    };
    playerComponents.set(DESCRIPTION_COMPONENT_TYPE, description);

    const location: IsPresentInRoomComponent = { // <-- Componente di locazione!
      type: LOCATION_COMPONENT_TYPE,
      roomId: STARTING_ROOM_ID, // <-- Imposta la stanza iniziale!
    };
    playerComponents.set(LOCATION_COMPONENT_TYPE, location);

    const inventory: InventoryComponent = {
      type: INVENTORY_COMPONENT_TYPE,
      items: [], // Inventario vuoto all'inizio
    };
    playerComponents.set(INVENTORY_COMPONENT_TYPE, inventory);

    worldState.set(playerId, playerComponents);
    server.log.info(`Added player entity ${playerId} to world state in room ${STARTING_ROOM_ID}. Total entities: ${worldState.size}`);

    clientConnections.set(connectionId, { connection: connection, playerId: playerId });

    connection.send(`Welcome ${description.name}! You are in ${STARTING_ROOM_ID}.`);
    // TODO: Inviare la descrizione della stanza iniziale


    // 1. Send a welcome message to the client when they connect
    connection.send(`Welcome to the MUD! Your ID: ${playerId}`);
    server.log.info(`<<< Sent welcome message to ${playerId}`);

    // TODO: Here you should create/associate a Player entity for this connection
    // and maybe send the initial room description.

    // 2. Handle messages received from the client
    connection.on('message', (message: Buffer) => {
      const messageString = message.toString();
      server.log.info(`Received from ${playerId} (${connectionId}): ${messageString}`);

      // Recupera l'ID del giocatore dalla nostra mappa
      const clientData = clientConnections.get(connectionId);
      if (!clientData) {
        server.log.error(`Received message from unknown connectionId ${connectionId}`);
        return;
      }
      const currentActorId = clientData.playerId; // <-- Usa l'ID del giocatore!

      const parserContext: CommandParserContext = {
        actorId: currentActorId
      };
      const parsedEvent = parseCommand(messageString, parserContext);

      if (parsedEvent) {
        gameEventEmitter.emit(parsedEvent.type, parsedEvent);
        server.log.info(`Emitted ${parsedEvent.type} for ${currentActorId}`);
        connection.send(`Command parsed: verb='${parsedEvent.verb}'`); // Feedback aggiornato
      } else {
        connection.send(`Could not parse empty input.`);
      }
    });

    // 3. Handle the disconnection
    connection.on('close', () => {
      server.log.info(`Client ${playerId} (${connectionId}) disconnected.`);
      const clientData = clientConnections.get(connectionId);
      if (clientData) {
        // TODO: Logica di rimozione/salvataggio entità giocatore
        // Per ora, rimuoviamo solo l'entità dallo stato attivo
        if (worldState) {
          worldState.delete(clientData.playerId);
          server.log.info(`Removed player entity ${clientData.playerId} from world state. Total entities: ${worldState.size}`);
        }
        clientConnections.delete(connectionId); // Rimuovi dalla mappa delle connessioni
      }
    });

    // 4. Handle connection errors
    connection.on('error', (error) => {
      server.log.error({ err: error }, `WebSocket error for client ${playerId} (${connectionId})`);
      // Potrebbe essere necessario rimuovere anche qui da clientConnections
      clientConnections.delete(connectionId);
      if (worldState && playerId) worldState.delete(playerId); // Rimuovi anche dallo stato
    });
  });

}