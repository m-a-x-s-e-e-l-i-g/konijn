"""Export the open Stampkonijn Blender scene as a GLB plus level manifest.

Run inside Blender's Scripting workspace, or from the command line:
blender --background path/to/level.blend --python tools/blender/export_level.py -- --output static/game/levels/house
"""

import argparse
import json
import os
import sys

import bpy


RESERVED_PROPERTIES = {
    "zone_id",
    "biome",
    "enabled_by",
    "entity_id",
    "entity_kind",
    "collider_id",
    "collider_shape",
}


def script_arguments():
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Export a Stampkonijn level")
    parser.add_argument("--output", required=True, help="Output path without extension")
    return parser.parse_args(arguments)


def json_value(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if hasattr(value, "to_list"):
        return value.to_list()
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    return str(value)


def custom_properties(obj):
    return {
        key: json_value(value)
        for key, value in obj.items()
        if key not in RESERVED_PROPERTIES and key != "_RNA_UI"
    }


def nearest_zone(obj):
    current = obj
    while current:
        zone_id = current.get("zone_id")
        if zone_id:
            return str(zone_id)
        current = current.parent
    raise ValueError(f"Object '{obj.name}' is not parented below a zone root")


def unique(items, key, label):
    values = set()
    for item in items:
        value = item[key]
        if value in values:
            raise ValueError(f"Duplicate {label}: '{value}'")
        values.add(value)


def build_manifest(model_filename):
    zones = []
    entities = []
    colliders = []

    for obj in bpy.context.scene.objects:
        if obj.get("zone_id"):
            zone = {
                "id": str(obj["zone_id"]),
                "node": obj.name,
                "biome": str(obj.get("biome", "ground")),
            }
            if obj.get("enabled_by"):
                zone["enabledBy"] = str(obj["enabled_by"])
            zones.append(zone)

        if obj.get("entity_kind"):
            entities.append(
                {
                    "id": str(obj.get("entity_id", obj.name)),
                    "node": obj.name,
                    "kind": str(obj["entity_kind"]),
                    "zone": nearest_zone(obj),
                    "properties": custom_properties(obj),
                }
            )

        if obj.get("collider_shape"):
            shape = str(obj["collider_shape"])
            if shape not in {"box", "mesh"}:
                raise ValueError(f"Collider '{obj.name}' has unsupported shape '{shape}'")
            colliders.append(
                {
                    "id": str(obj.get("collider_id", obj.name)),
                    "node": obj.name,
                    "zone": nearest_zone(obj),
                    "shape": shape,
                }
            )

    if not zones:
        raise ValueError("No zone roots found. Add a 'zone_id' custom property to an Empty.")
    unique(zones, "id", "zone id")
    unique(entities, "id", "entity id")
    unique(colliders, "id", "collider id")

    return {
        "version": 1,
        "id": str(bpy.context.scene.get("level_id", bpy.path.display_name_from_filepath(bpy.data.filepath))),
        "model": f"./{model_filename}",
        "zones": sorted(zones, key=lambda item: item["id"]),
        "entities": sorted(entities, key=lambda item: item["id"]),
        "colliders": sorted(colliders, key=lambda item: item["id"]),
    }


def main():
    args = script_arguments()
    output_base = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_base), exist_ok=True)
    glb_path = f"{output_base}.glb"
    manifest_path = f"{output_base}.level.json"
    manifest = build_manifest(os.path.basename(glb_path))

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_extras=True,
        export_apply=True,
        export_yup=True,
    )
    with open(manifest_path, "w", encoding="utf-8") as manifest_file:
        json.dump(manifest, manifest_file, indent=2, ensure_ascii=False)
        manifest_file.write("\n")

    print(f"Exported {glb_path}")
    print(f"Exported {manifest_path}")


if __name__ == "__main__":
    main()
