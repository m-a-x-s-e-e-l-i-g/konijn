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
4. Export the existing static house to GLB and load all nine zones through `WorldLoader`. (Complete.)
5. Import the generated GLB into Blender and adopt a `.blend` file as the visual source of truth.
6. Introduce a physics adapter before considering Rapier, so the current collision code can remain the first implementation.

The `.blend` file becomes source art after the generated GLB is imported. The `.glb` and `.level.json` are runtime artifacts; `scripts/export-stampkonijn-map.mjs` remains the reproducible initial migration. Game mechanics stay in TypeScript; Blender custom properties contain stable ids and configuration, not executable logic.
