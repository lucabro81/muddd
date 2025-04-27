import { WebSocket } from "@fastify/websocket";
import { type FastifyInstance, type FastifyRequest } from "fastify";
import { type WorldType, gameEventEmitter, parseCommand, CommandParserContext } from "core/main.js"

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
    const clientId = req.id; // Usa l'ID della richiesta Fastify come ID client temporaneo
    server.log.info(`Client ${clientId} attempting WebSocket connection from ${req.ip}`);

    // 1. Send a welcome message to the client when they connect
    connection.send(`Welcome to the MUD! Your ID: ${clientId}`);
    server.log.info(`<<< Sent welcome message to ${clientId}`);

    // TODO: Here you should create/associate a Player entity for this connection
    // and maybe send the initial room description.

    // 2. Handle messages received from the client
    connection.on('message', (message: Buffer) => {
      const messageString = message.toString();
      server.log.info(`Received from ${clientId}: ${messageString}`);

      // Prepare the context for the parser
      // TODO: Replace 'clientId' with the EntityId of the real player associated with this connection
      const parserContext: CommandParserContext = {
        actorId: clientId
      };


      const commandEvent = parseCommand(messageString, parserContext);
      if (commandEvent) {
        gameEventEmitter.emit(commandEvent.type, commandEvent);
      }

      if (commandEvent) {
        gameEventEmitter.emit(commandEvent.type, commandEvent);
        server.log.info(`Emitted ${commandEvent.type} for ${clientId}`);

        connection.send(`Command parsed: verb='${commandEvent.verb}', args='${commandEvent.args?.join(' ')}'`);

      } else {
        connection.send(`Could not parse empty input.`);
      }

      // For now, we send a confirmation echo
      connection.send(`Server received: ${messageString}`);
    });

    // 3. Handle the disconnection
    connection.on('close', () => {
      server.log.info(`Client ${clientId} disconnected.`);
      // TODO: Here you should handle the disconnection of the Player (remove entity?, save state?)
    });

    // 4. Handle connection errors
    connection.on('error', (error: Error) => {
      server.log.error({ err: error }, `WebSocket connection error for client ${clientId}`);
      // TODO: Handle the error, maybe disconnecting the client
    });
  });

}