import {
  type GameEvent,
  type WorldType,
  CommandFailedEvent,
  DropCommandEvent,
  EntityMoveEvent,
  EventType,
  ExamineCommandEvent,
  gameEventEmitter,
  InventoryCommandEvent,
  LookRoomEvent,
  LookTargetEvent,
  OllamaProvider,
  PickupCommandEvent,
  PutCommandEvent,
  SearchCommandEvent,
  StateUpdatedEvent,
  UseCommandEvent
} from "core/main.js";
import {
  generalEventHandler,
  stateUpdatedEventHandler,
  entityMoveEventHandler,
  lookTargetEventHandler,
  lookRoomEventHandler,
  searchCommandEventHandler,
  pickCommandEventHandler,
  inventoryCommandEventHandler,
  putCommandEventHandler,
  useCommandEventHandler,
  commandFailedEventHandler,
  examineCommandEventHandler,
  dropCommandEventHandler,
  type ClientConnetionMap
} from "./events-handlers/index.js";


const ollamaBaseUrl = process.env.OLLAMA_BASE_URL
const llmModel = process.env.OLLAMA_MODEL;

if (!ollamaBaseUrl || !llmModel) {
  throw new Error('OLLAMA_BASE_URL and OLLAMA_MODEL must be set');
}

const llmProvider = new OllamaProvider(ollamaBaseUrl);

const setGameEventEmitter = (worldState: WorldType | null, clientConnections: ClientConnetionMap) => {

  gameEventEmitter.on('*',
    (event: GameEvent) => generalEventHandler(event, worldState));

  // STATE_UPDATED: this is the main event that triggers all the other events
  gameEventEmitter.on<StateUpdatedEvent>(EventType.STATE_UPDATED,
    (event: StateUpdatedEvent) => stateUpdatedEventHandler(event, worldState));

  // ENTITY_MOVE: this is the event that triggers the entity move
  gameEventEmitter.on<EntityMoveEvent>(EventType.ENTITY_MOVE,
    (event: EntityMoveEvent) => entityMoveEventHandler(event, worldState, clientConnections));

  // LOOK_TARGET: light version of the @examine command
  gameEventEmitter.on<LookTargetEvent>(EventType.LOOK_TARGET,
    (event: LookTargetEvent) => lookTargetEventHandler(event, worldState, clientConnections, llmProvider, llmModel));

  // LOOK_ROOM: this is the event that triggers the look room
  gameEventEmitter.on<LookRoomEvent>(EventType.LOOK_ROOM,
    (event: LookRoomEvent) => lookRoomEventHandler(event, worldState, clientConnections, llmProvider, llmModel));

  // SEARCH_COMMAND: this is the event that triggers the search command
  gameEventEmitter.on<SearchCommandEvent>(EventType.SEARCH_COMMAND,
    (event: SearchCommandEvent) => searchCommandEventHandler(event, worldState, clientConnections));

  // PICKUP_COMMAND: put an item in the player's inventory
  gameEventEmitter.on<PickupCommandEvent>(EventType.PICKUP_COMMAND,
    (event: PickupCommandEvent) => pickCommandEventHandler(event, worldState, clientConnections));

  // INVENTORY_COMMAND: list the player's inventory
  gameEventEmitter.on<InventoryCommandEvent>(EventType.INVENTORY_COMMAND,
    (event: InventoryCommandEvent) => inventoryCommandEventHandler(event, worldState, clientConnections));

  // PUT_COMMAND: this is the event that triggers the put command @deprecated
  gameEventEmitter.on<PutCommandEvent>(EventType.PUT_COMMAND,
    (event: PutCommandEvent) => putCommandEventHandler(event, worldState, clientConnections));

  // USE_COMMAND: use an item on an entity
  gameEventEmitter.on<UseCommandEvent>(EventType.USE_COMMAND,
    (event: UseCommandEvent) => useCommandEventHandler(event, worldState, clientConnections));

  // COMMAND_FAILED: command failed
  gameEventEmitter.on<CommandFailedEvent>(EventType.COMMAND_FAILED,
    (event: CommandFailedEvent) => commandFailedEventHandler(event, worldState, clientConnections));

  // EXAMINE_COMMAND: detailed description of an entity
  gameEventEmitter.on<ExamineCommandEvent>(EventType.EXAMINE_COMMAND,
    (event: ExamineCommandEvent) => examineCommandEventHandler(event, worldState, clientConnections, llmProvider, llmModel));

  // DROP_COMMAND: drop an item from the player's inventory to the current room
  gameEventEmitter.on<DropCommandEvent>(EventType.DROP_COMMAND,
    (event: DropCommandEvent) => dropCommandEventHandler(event, worldState, clientConnections));
}

export { setGameEventEmitter };
