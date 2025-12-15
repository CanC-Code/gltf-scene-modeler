/*
  Minecraft Bedrock Entity Generator

  Produces:
  - Resource Pack entity definition
  - Behavior Pack entity definition

  Designed for simple mobs (e.g. slimes, RPG enemies)
*/

export function generateResourceEntity(options = {}) {
    const identifier = options.identifier || "voxel:slime";
    const geometry = options.geometry || "geometry.voxel_model";
    const texture = options.texture || "textures/entity/slime";

    return {
        format_version: "1.10.0",
        "minecraft:client_entity": {
            description: {
                identifier,
                materials: {
                    default: "entity_alphatest"
                },
                textures: {
                    default: texture
                },
                geometry: {
                    default: geometry
                },
                render_controllers: [
                    "controller.render.default"
                ]
            }
        }
    };
}

export function generateBehaviorEntity(options = {}) {
    const identifier = options.identifier || "voxel:slime";

    return {
        format_version: "1.19.0",
        "minecraft:entity": {
            description: {
                identifier,
                is_spawnable: true,
                is_summonable: true,
                is_experimental: false
            },
            components: {
                "minecraft:type_family": {
                    family: ["slime", "monster"]
                },
                "minecraft:health": {
                    value: 16,
                    max: 16
                },
                "minecraft:movement": {
                    value: 0.2
                },
                "minecraft:collision_box": {
                    width: 0.9,
                    height: 0.9
                },
                "minecraft:behavior.float": {
                    priority: 0
                },
                "minecraft:behavior.random_stroll": {
                    priority: 1
                },
                "minecraft:behavior.look_at_player": {
                    priority: 2
                },
                "minecraft:behavior.melee_attack": {
                    priority: 3
                },
                "minecraft:attack": {
                    damage: 3
                },
                "minecraft:loot": {
                    table: "loot_tables/entities/slime.json"
                }
            }
        }
    };
}

/*
  Utility to download JSON files
*/
export function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}