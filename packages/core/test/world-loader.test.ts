import {
  CONNECTIONS_COMPONENT_TYPE,
  DESCRIPTION_COMPONENT_TYPE,
  INVENTORY_COMPONENT_TYPE,
  LOCATION_COMPONENT_TYPE,
  PICKUPABLE_COMPONENT_TYPE,
  BUTTON_STATE_COMPONENT_TYPE
} from './../src/common/types';
import { WorldType, EntityId, DescriptionComponent, InventoryComponent, ButtonStateComponent } from './../src/common/types';
import { loadWorldStateFromFile } from './../src/world-loader';
// packages/core/src/world-loader.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';


// Define the relative path to the root of the package 'core'
const TEST_FIXTURE_DIR = 'test/fixtures';
const TEST_WORLD_FILENAME = 'test-world.json';
const WORLD_FIXTURE_PATH = path.join(TEST_FIXTURE_DIR, TEST_WORLD_FILENAME);
const INVALID_JSON_PATH = path.join(TEST_FIXTURE_DIR, 'invalid-world.json');
const NONEXISTENT_FILE_PATH = path.join(TEST_FIXTURE_DIR, 'nonexistent-file.json');

// Test data structure for our test world
const testWorldJsonData = {
  "entities": [
    {
      "id": "room_entrance", "components": [
        { "type": DESCRIPTION_COMPONENT_TYPE, "name": "Ingresso della Caverna", "keywords": ["caverna"], "text": "Descrizione stanza 1..." },
        { "type": CONNECTIONS_COMPONENT_TYPE, "exits": { "nord": ["room_inner_cave"] } },
        { "type": INVENTORY_COMPONENT_TYPE, "items": ["button_rusty"] }
      ]
    },
    {
      "id": "room_inner_cave", "components": [
        { "type": DESCRIPTION_COMPONENT_TYPE, "name": "Interno della Caverna", "keywords": ["caverna"], "text": "Descrizione stanza 2..." },
        { "type": CONNECTIONS_COMPONENT_TYPE, "exits": { "sud": ["room_entrance"] } },
        { "type": INVENTORY_COMPONENT_TYPE, "items": [] }
      ]
    },
    {
      "id": "button_rusty", "components": [
        { "type": DESCRIPTION_COMPONENT_TYPE, "name": "Bottone Arrugginito su Piastra", "keywords": ["bottone"], "text": "Descrizione bottone..." },
        { "type": LOCATION_COMPONENT_TYPE, "roomId": "room_entrance" },
        { "type": BUTTON_STATE_COMPONENT_TYPE, "isPushed": false },
        { "type": PICKUPABLE_COMPONENT_TYPE }
      ]
    }
  ]
};

describe('World Loader', () => {

  // Crea la cartella e il file JSON prima di eseguire i test
  beforeAll(() => {
    if (!fs.existsSync(TEST_FIXTURE_DIR)) {
      fs.mkdirSync(TEST_FIXTURE_DIR, { recursive: true });
    }
    fs.writeFileSync(WORLD_FIXTURE_PATH, JSON.stringify(testWorldJsonData, null, 2));
    console.log(`Test fixture created at ${path.resolve(process.cwd(), WORLD_FIXTURE_PATH)}`);
  });

  // Pulisce i file di test dopo l'esecuzione
  afterAll(() => {
    if (fs.existsSync(WORLD_FIXTURE_PATH)) {
      fs.unlinkSync(WORLD_FIXTURE_PATH);
    }
    if (fs.existsSync(INVALID_JSON_PATH)) {
      fs.unlinkSync(INVALID_JSON_PATH);
    }
  });

  it('should load world state correctly from a valid JSON file', () => {
    let worldState: WorldType | null = null;

    // Action
    expect(() => {
      // Pass the relative path to the root of the package where the test is being executed
      worldState = loadWorldStateFromFile(WORLD_FIXTURE_PATH);
    }).not.toThrow();

    expect(worldState).toBeInstanceOf(Map);
    if (!worldState) return;

    const surelyWorldStateAsWorldType = worldState as WorldType;
    expect(surelyWorldStateAsWorldType.size).toBe(3);

    // Check Room 1
    const room1Id: EntityId = 'room_entrance';
    expect(surelyWorldStateAsWorldType.has(room1Id)).toBe(true);
    const room1Comps = surelyWorldStateAsWorldType.get(room1Id);
    expect(room1Comps).toBeInstanceOf(Map);
    expect(room1Comps?.size).toBe(3);
    expect(room1Comps?.has(DESCRIPTION_COMPONENT_TYPE)).toBe(true);
    const room1Desc = room1Comps?.get(DESCRIPTION_COMPONENT_TYPE) as DescriptionComponent | undefined;
    expect(room1Desc?.name).toBe('Ingresso della Caverna');
    const room1Inv = room1Comps?.get(INVENTORY_COMPONENT_TYPE) as InventoryComponent | undefined;
    expect(room1Inv?.items).toEqual(['button_rusty']);

    // Check Button
    const buttonId: EntityId = 'button_rusty';
    expect(surelyWorldStateAsWorldType.has(buttonId)).toBe(true);
    const buttonComps = surelyWorldStateAsWorldType.get(buttonId);
    expect(buttonComps).toBeInstanceOf(Map);
    expect(buttonComps?.size).toBe(4);
    expect(buttonComps?.has(PICKUPABLE_COMPONENT_TYPE)).toBe(true);
    const buttonState = buttonComps?.get(BUTTON_STATE_COMPONENT_TYPE) as ButtonStateComponent | undefined;
    expect(buttonState?.isPushed).toBe(false);

    // Check Room 2 (minimal)
    const room2Id: EntityId = 'room_inner_cave';
    expect(surelyWorldStateAsWorldType.has(room2Id)).toBe(true);
    const room2Comps = surelyWorldStateAsWorldType.get(room2Id);
    expect(room2Comps).toBeInstanceOf(Map);
    expect(room2Comps?.size).toBe(3);
  });

  it('should throw an error if the file does not exist', () => {
    expect(() => {
      loadWorldStateFromFile(NONEXISTENT_FILE_PATH);
    }).toThrow(/File not found|ENOENT/);
  });

  it('should throw an error for invalid JSON content', () => {
    // Create an invalid JSON file on the fly
    fs.writeFileSync(INVALID_JSON_PATH, '{"entities": [{}');
    expect(() => {
      loadWorldStateFromFile(INVALID_JSON_PATH);
    }).toThrow(/Invalid world JSON format|JSON Parse error/i);
    // No need to delete it here if there is afterAll
  });

  it('should throw an error if the file does not contain a valid world', () => {
    fs.writeFileSync(WORLD_FIXTURE_PATH, '{"entities": [{"id": "room_entrance", "components": [{"type": "description"}]}}');
    expect(() => {
      loadWorldStateFromFile(WORLD_FIXTURE_PATH);
    }).toThrow(/Invalid world JSON format|JSON Parse error/i);
  });

  it('should throw an error if the file does not contain a valid component', () => {
    fs.writeFileSync(WORLD_FIXTURE_PATH, `
      {
        "entities": [{
          "id": "button_rusty",
          "components": [
            {
              "type": "buttonState",
              "isPushed": "lol"
            }
          ]
        }]
      }`);
    const worldState = loadWorldStateFromFile(WORLD_FIXTURE_PATH);
    expect(worldState).toBeInstanceOf(Map);
    // The button_rusty entity should not have any components because the "isPushed" is not a boolean
    expect(worldState.get("button_rusty")?.size).toBe(0);
  });

});