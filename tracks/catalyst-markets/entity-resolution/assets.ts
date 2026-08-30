export type AssetRecord = {
  assetId: string;
  preferredName: string;
  aliases: string[];
  target: string | null;
  modality: string | null;
};

const ASSETS: AssetRecord[] = [
  {
    assetId: "asset_xyz101",
    preferredName: "XYZ-101",
    aliases: ["xyz-101", "xyz101"],
    target: "PD-L1",
    modality: "monoclonal_antibody",
  },
  {
    assetId: "asset_abc202",
    preferredName: "ABC-202",
    aliases: ["abc-202", "abc202"],
    target: "KRAS",
    modality: "small_molecule",
  },
];

export function resolveAsset(name: string): AssetRecord | null {
  const key = name.trim().toLowerCase();
  return (
    ASSETS.find(
      (a) =>
        a.preferredName.toLowerCase() === key ||
        a.aliases.some((x) => x === key) ||
        a.assetId === key,
    ) ?? null
  );
}

export function listAssets(): AssetRecord[] {
  return [...ASSETS];
}
