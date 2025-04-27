import { WorldType } from "core/common/types.js";
import { type FastifyInstance } from "fastify";

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

}