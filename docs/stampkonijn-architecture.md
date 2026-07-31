# Stampkonijn architecture

`StampKonijnGame` stays the API used by Svelte. Internally, new work belongs in focused modules instead of growing `stampkonijn.ts` further.

## Ownership

- `core/GameEvents.ts`: typed communication between game code and the Svelte facade.
- `systems/AudioSystem.ts`: audio assets, playback, cooldowns and Web Audio lifecycle.
- `config/`: data and tuning values owned by a system.
- `world/LevelManifest.ts`: validated contract between Blender exports and runtime code.
- `world/WorldLoader.ts`: loads a manifest and GLB and resolves stable ids to Three.js nodes.
- `types.ts`: contracts shared across modules and the UI.
- `stampkonijn.ts`: temporary composition root and legacy gameplay implementation.

Systems should receive only their explicit dependencies. They communicate through typed events or small method calls; they should not reach into Svelte state or import the game facade.

## Migration sequence

1. Keep behavior stable while extracting leaf systems (audio, VFX and weapons).
2. Move rabbit movement, stamps and arm ragdoll behind a player controller.
3. Move breakables, doors and projectiles into systems that consume the typed events.
4. Rebuild the living room in Blender and load it through `WorldLoader`.
5. Migrate one unlockable zone at a time; remove its old procedural builder only after an in-game comparison.
6. Introduce a physics adapter before considering Rapier, so the current collision code can remain the first implementation.

The `.blend` file is source art. The `.glb` and `.level.json` are generated runtime artifacts. Game mechanics stay in TypeScript; Blender custom properties contain stable ids and configuration, not executable logic.
