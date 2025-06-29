# 1. Core Gameplay Loop:

- **DONE** - Implement the drop command.
- Design a system for NPC interactions, carefully considering the security and flow-control issues you raised for LLM-driven characters like Caronte.

# 2. World Dynamism & Narrative:

- Create a "cut-scene" system for key narrative moments (like solving the inscription puzzle).
- Implement a basic global clock or event trigger system that can change the state of the world and thus influence LLM descriptions (your great point about repercussions).

# 3. Client-Side UX & Tooling:

- Add command history to the client terminal.
- Add a way to stop/skip streaming descriptions.
- Create a client-side debug mode.

# 4. StateUpdatedEvent

- **DONE** - Add a StateUpdatedEvent to the game event emitter.

# 5. Testing:

- tests for changing state events.
- tests for custom logic events.
- tests for every command.
