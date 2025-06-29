// apps/server/src/server.test.ts
import { loadWorldStateFromFile } from 'core/main.js';
import { FastifyInstance } from 'fastify';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/utils.js';


const WORLD_FIXTURE_PATH = 'test/fixtures/test-world.json';

describe('Server API Routes', () => {
  let server: FastifyInstance;
  let serverAddress: string;
  let serverPort: number;

  // Build the server instance and start listening once before all tests
  beforeAll(async () => {
    const worldState = loadWorldStateFromFile(WORLD_FIXTURE_PATH);
    server = await buildServer(worldState);
    await server.listen({ port: 0 }); // Use port 0 for a random available port
    const address = server.server.address() as AddressInfo;
    serverPort = address.port;
    serverAddress = `ws://localhost:${serverPort}/ws`; // Build the WS URL
    console.log('Server listening on:', serverAddress);
    console.log(`Test server listening on http://localhost:${serverPort} and ${serverAddress}`);
  });

  // Close the server after all tests
  afterAll(async () => {
    await server.close();
  });

  // --- Test for the HTTP /status route ---
  describe('GET /status', () => {
    it('should return status OK and world entity count', async () => {
      // We need the full URL now since the server is actually listening
      const response = await server.inject({
        method: 'GET',
        url: `http://localhost:${serverPort}/status`, // Use the actual port
      });

      // Verify the status code
      expect(response.statusCode).toBe(200);

      // Verify the JSON payload
      const payload = response.json();
      expect(payload).toBeTypeOf('object');
      expect(payload.status).toBe('running');
      // NOTE: Update this expected count if your test world.json changes
      expect(payload.worldEntitiesLoaded).toBeGreaterThanOrEqual(0); // Check it's a number >= 0
      expect(payload.timestamp).toBeTypeOf('string');
    });
  });

  // --- Test for the WebSocket /ws route ---
  // describe('GET /ws (WebSocket)', () => {
  //   // Remove the nested beforeAll/afterAll for listening, it's handled above

  //   it('should accept connection and send welcome message', async () => {
  //     let client: WebSocket | null = null;
  //     let welcomeMessage = '';

  //     // Use a Promise to handle the async connection and message
  //     await new Promise<void>((resolve, reject) => {
  //       // Use the serverAddress defined in the outer scope
  //       client = new WebSocket(serverAddress);

  //       client.on('open', () => {
  //         console.log('Test client connected');
  //         // The connection is open, now we wait for the message
  //       });

  //       client.on('message', (data) => {
  //         console.log('Test client received:', data.toString());
  //         welcomeMessage = data.toString();
  //         client?.close(); // Close after receiving the message
  //         resolve();
  //       });

  //       client.on('error', (err) => {
  //         console.error('Test client error:', err);
  //         client?.close();
  //         reject(err); // Reject the promise on error
  //       });

  //       client.on('close', (code, reason) => {
  //         console.log(`Test client closed: ${code} ${reason?.toString()}`);
  //         // If resolve hasn't been called yet, it means we closed before getting the message
  //         if (!welcomeMessage) {
  //           reject(new Error(`Connection closed prematurely with code ${code}`));
  //         }
  //       });
  //     });

  //     // Verify the welcome message (adjust based on your actual welcome message)
  //     expect(welcomeMessage).toContain(/Welcome to the MUD! Your ID:/); // Verify part of the message

  //   }, 10000); // Timeout

  //   // it('should echo received messages', async () => {
  //   //   let client: WebSocket | null = null;
  //   //   const testMessage = 'Hello MUD Server!';
  //   //   let receivedMessages: string[] = [];

  //   //   await new Promise<void>((resolve, reject) => {
  //   //     // Use the serverAddress defined in the outer scope
  //   //     client = new WebSocket(serverAddress);

  //   //     client.on('open', () => {
  //   //       // Send the message once connected (after potential welcome message)
  //   //       client?.send(testMessage);
  //   //     });

  //   //     client.on('message', (data) => {
  //   //       const messageStr = data.toString();
  //   //       receivedMessages.push(messageStr);
  //   //       // We expect the welcome message first, then the echo.
  //   //       if (receivedMessages.length >= 2 && messageStr.includes(`Server received: ${testMessage}`)) {
  //   //         client?.close();
  //   //         resolve();
  //   //       }
  //   //     });

  //   //     client.on('error', (err) => {
  //   //       console.error('Test client error (echo test):', err);
  //   //       client?.close();
  //   //       reject(err);
  //   //     });

  //   //     client.on('close', (code) => {
  //   //       // If we haven't received the echo by the time it closes, fail.
  //   //       if (!receivedMessages.some(msg => msg.includes(`Server received: ${testMessage}`))) {
  //   //         reject(new Error(`Connection closed (code ${code}) before receiving echo. Received: ${receivedMessages.join(', ')}`));
  //   //       }
  //   //     });
  //   //   });

  //   //   // Verify that the echo is present
  //   //   expect(receivedMessages.some(msg => msg.includes(`Server received: ${testMessage}`))).toBe(true);

  //   // }, 10000); // Timeout

  // });
});