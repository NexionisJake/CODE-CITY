export type Archetype = "house" | "apartment" | "tower" | "skyscraper";

export function getArchetype(loc: number): Archetype {
  if (loc < 50)  return "house";
  if (loc < 150) return "apartment";
  if (loc < 400) return "tower";
  return "skyscraper";
}

// Multiple variants per archetype — same file_path always picks same variant (deterministic)
export const BUILDING_MODELS: Record<Archetype, string[]> = {
  house:       ["/kenny/buildings/house-1.glb", "/kenny/buildings/house-2.glb", "/kenny/buildings/house-3.glb"],
  apartment:   ["/kenny/buildings/apartment-1.glb", "/kenny/buildings/apartment-2.glb", "/kenny/buildings/apartment-3.glb"],
  tower:       ["/kenny/buildings/tower-1.glb", "/kenny/buildings/tower-2.glb", "/kenny/buildings/tower-3.glb"],
  skyscraper:  ["/kenny/buildings/skyscraper-1.glb", "/kenny/buildings/skyscraper-2.glb", "/kenny/buildings/skyscraper-3.glb", "/kenny/buildings/skyscraper-4.glb"],
};

// Deterministic: same file_path always picks same variant
export function pickModel(archetype: Archetype, filePath: string): string {
  const models = BUILDING_MODELS[archetype];
  const hash = filePath.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return models[hash % models.length];
}

// IMPORTANT: Measure these by loading each GLB in https://gltf.pmnd.rs/
// These are the native heights of each archetype group in GLB units.
// Set all to 1.0 for now — we will auto-measure them at runtime (see KenneyBuilding).
export const MODEL_NATIVE_HEIGHTS: Record<Archetype, number> = {
  house:      1.0,
  apartment:  2.0,
  tower:      3.0,
  skyscraper: 5.0,
};
