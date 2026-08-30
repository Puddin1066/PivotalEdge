import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TemporalProvenance } from "@pivotaledge/schemas";

export type VaultEntry = {
  id: string;
  sourceSystem: string;
  sourceUrl: string;
  checksum: string;
  retrievedAt: string;
  firstPublicAt: string | null;
  contentType: string;
  relativePath: string;
};

export type VaultManifest = {
  version: 1;
  entries: VaultEntry[];
};

export function checksumPayload(data: string | Buffer): string {
  const hash = createHash("sha256");
  hash.update(data);
  return `sha256:${hash.digest("hex")}`;
}

export class DocumentVault {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private manifestPath(): string {
    return path.join(this.rootDir, "manifest.json");
  }

  async ensureReady(): Promise<void> {
    await mkdir(path.join(this.rootDir, "objects"), { recursive: true });
    try {
      await readFile(this.manifestPath(), "utf8");
    } catch {
      const manifest: VaultManifest = { version: 1, entries: [] };
      await writeFile(this.manifestPath(), JSON.stringify(manifest, null, 2));
    }
  }

  async loadManifest(): Promise<VaultManifest> {
    await this.ensureReady();
    const raw = await readFile(this.manifestPath(), "utf8");
    return JSON.parse(raw) as VaultManifest;
  }

  private async saveManifest(manifest: VaultManifest): Promise<void> {
    await writeFile(this.manifestPath(), JSON.stringify(manifest, null, 2));
  }

  /** Store immutable raw payload; returns vault entry (deduped by checksum). */
  async store(params: {
    sourceSystem: string;
    sourceUrl: string;
    payload: unknown;
    contentType?: string;
    firstPublicAt?: string | null;
    retrievedAt?: string;
  }): Promise<VaultEntry> {
    await this.ensureReady();
    const body = JSON.stringify(params.payload, null, 2);
    const checksum = checksumPayload(body);
    const manifest = await this.loadManifest();
    const existing = manifest.entries.find((e) => e.checksum === checksum);
    if (existing) return existing;

    const id = checksum.replace("sha256:", "").slice(0, 16);
    const relativePath = path.join("objects", `${id}.json`);
    const absPath = path.join(this.rootDir, relativePath);
    await writeFile(absPath, body, "utf8");

    const entry: VaultEntry = {
      id,
      sourceSystem: params.sourceSystem,
      sourceUrl: params.sourceUrl,
      checksum,
      retrievedAt: params.retrievedAt ?? new Date().toISOString(),
      firstPublicAt: params.firstPublicAt ?? null,
      contentType: params.contentType ?? "application/json",
      relativePath,
    };
    manifest.entries.push(entry);
    await this.saveManifest(manifest);
    return entry;
  }

  async read(entry: VaultEntry): Promise<unknown> {
    const absPath = path.join(this.rootDir, entry.relativePath);
    const raw = await readFile(absPath, "utf8");
    return JSON.parse(raw) as unknown;
  }

  toProvenance(entry: VaultEntry, extras?: Partial<TemporalProvenance>): TemporalProvenance {
    return {
      sourceUrl: entry.sourceUrl,
      sourceSystem: entry.sourceSystem,
      retrievedAt: entry.retrievedAt,
      firstPublicAt: entry.firstPublicAt,
      effectiveAt: entry.firstPublicAt,
      versionId: entry.id,
      checksum: entry.checksum,
      exactPassage: extras?.exactPassage ?? null,
      locator: extras?.locator ?? null,
      accessClass: "open",
    };
  }
}
