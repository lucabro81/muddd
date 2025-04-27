// packages/core/src/events/GameEventEmitter.ts
import { type Listener } from 'eventemitter2';
import { GameEvent } from './events.types.js'; // Importa il tipo unione

// to build into esm
import pkg from 'eventemitter2';
const { EventEmitter2 } = pkg;

class GameEventEmitter extends EventEmitter2 {
  constructor() {
    super({
      wildcard: true, // Abilita i wildcard se ti servono (come da stack doc [3])
      delimiter: '.', // Definisci un delimitatore per i namespace se usi wildcard
    });
  }

  // Metodo per emettere con type safety
  emit<T extends GameEvent>(type: GameEvent['type'], event: T): boolean {
    console.log(`Emitting Event: ${event.type}`, event); // Logging utile per il debug iniziale
    // Usiamo il tipo di evento come nome dell'evento per l'emitter
    return super.emit(type, event);
  }

  // Metodo per ascoltare con type safety (overload o generics)
  // Questo è un esempio semplice, potresti voler migliorare la type safety qui
  on<T extends GameEvent>(
    eventType: T['type'] | '*', // Ascolta sul tipo specifico dell'evento
    listener: (event: T) => void
  ): this | Listener {
    return super.on(eventType, listener as (event: GameEvent) => void);
  }

  // Potresti aggiungere metodi specifici per `once`, `off`, ecc.
}

// Esporta una singola istanza (Singleton pattern) o la classe stessa
export const gameEventEmitter = new GameEventEmitter();