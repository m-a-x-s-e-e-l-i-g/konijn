# Stampkonijn level workflow

The game loads its static room geometry, placement, zone roots and gameplay surfaces from `static/game/levels/stampkonijn-house.glb` plus `stampkonijn-house.level.json`. TypeScript now owns only interactive objects and mechanics.

`scripts/export-stampkonijn-map.mjs` is the repeatable code-to-asset migration used to create the initial GLB. Run `npm run export:map` when changing that migration script. For normal visual editing, import the GLB into Blender, save it as `art/levels/stampkonijn-house.blend`, preserve the names and custom properties below, and use the Blender export command.

## Blender setup

1. Put each unlockable area below an Empty used as its zone root. Keep exterior walls under an
   always-visible `house_shell` zone so hiding an undiscovered room never removes the facade.
2. Give that Empty the custom property `zone_id`, for example `living_room`.
3. Give it a `biome` property: `ground`, `outside`, `upstairs`, `basement` or `sewer`.
4. An initially hidden zone may have `enabled_by`, containing the gameplay unlock id.
5. Parent every object in the zone below that Empty. Object names must be unique across the file.

Gameplay objects receive custom properties:

| Property          | Example                  | Meaning                                               |
| ----------------- | ------------------------ | ----------------------------------------------------- |
| `entity_kind`     | `breakable`              | Runtime factory that owns the object                  |
| `entity_id`       | `living_room_vase`       | Stable id used by save/gameplay state                 |
| `value`           | `20`                     | Score value; exported in `properties`                 |
| `material`        | `ceramic`                | Audio/debris material                                 |
| `stamps_required` | `2`                      | Hits required before breaking                         |
| `collider_shape`  | `box`                    | Collider generated from this object (`box` or `mesh`) |
| `collider_id`     | `living_room_wall_north` | Stable collider id                                    |

Use simple hidden meshes for colliders. Prefer `box`; use `mesh` only when the shape truly needs it.

## Export

Regenerate the initial code-authored asset:

```powershell
npm run export:map
```

After adopting a Blender source file, export it from the repository root with Blender available on `PATH`:

```powershell
blender --background art/levels/stampkonijn-house.blend --python tools/blender/export_level.py -- --output static/game/levels/stampkonijn-house
```

This writes `stampkonijn-house.glb` and `stampkonijn-house.level.json`. The runtime parser rejects duplicate ids, unknown zones and missing GLB nodes early, instead of failing halfway through play.
