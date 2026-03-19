export interface VariantSet {
  name: string;
  variants: string[];
}

export interface Ktx2Integrity {
  identifier: string;
  vkFormat: number;
  pixelWidth: number;
  pixelHeight: number;
  levelCount: number;
}

export interface UsdIntegrity {
  defaultPrim: string;
  metersPerUnit: number;
  variantSets: string[];
}

export interface AssetMetadata {
  schemaVersion?: number;
  assetId: string;
  sourceFile: string;
  tags: string[];
  variantSets: VariantSet[];
  dependencies: string[];
  ktx2Integrity?: Ktx2Integrity;
  usdIntegrity?: UsdIntegrity;
}

export interface BuildArtifact {
  assetId: string;
  schemaVersion: number;
  bundlePath: string;
  variants: Record<string, string>;
  dependencies: string[];
  tags: string[];
}

const CURRENT_SCHEMA_VERSION = 2;

export class MetadataIngestor {
  constructor(private readonly buildRoot: string) {
    if (!buildRoot) {
      throw new Error('buildRoot is required.');
    }
  }

  ingest(metadata: AssetMetadata): BuildArtifact {
    const evolvedMetadata = this.evolveMetadata(metadata);
    this.validateMetadata(evolvedMetadata);

    const variants: Record<string, string> = {};
    for (const set of evolvedMetadata.variantSets) {
      for (const variant of set.variants) {
        const key = `${set.name}:${variant}`;
        if (variants[key]) {
          throw new Error(`Duplicate variant entry detected: ${key}`);
        }
        variants[key] = this.buildPath(evolvedMetadata.assetId, set.name, variant);
      }
    }

    return {
      assetId: evolvedMetadata.assetId,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      bundlePath: this.buildPath(evolvedMetadata.assetId, '', 'bundle.usdz'),
      variants,
      dependencies: [...new Set(evolvedMetadata.dependencies)].sort(),
      tags: evolvedMetadata.tags.map((tag) => tag.toLowerCase()).sort()
    };
  }

  private evolveMetadata(metadata: AssetMetadata): AssetMetadata {
    const incomingVersion = metadata.schemaVersion ?? 1;

    if (incomingVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported metadata schema version ${incomingVersion}. Max supported version is ${CURRENT_SCHEMA_VERSION}.`
      );
    }

    if (incomingVersion === CURRENT_SCHEMA_VERSION) {
      return {
        ...metadata,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tags: metadata.tags ?? [],
        dependencies: metadata.dependencies ?? [],
        variantSets: metadata.variantSets ?? []
      };
    }

    return {
      ...metadata,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tags: (metadata.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      dependencies: (metadata.dependencies ?? []).map((dep) => dep.trim()).filter(Boolean),
      variantSets: (metadata.variantSets ?? []).map((set) => ({
        name: set.name.trim(),
        variants: set.variants.map((variant) => variant.trim()).filter(Boolean)
      }))
    };
  }

  private validateMetadata(metadata: AssetMetadata): void {
    if (!/^[-_a-zA-Z0-9]+$/.test(metadata.assetId)) {
      throw new Error(`Invalid asset id: ${metadata.assetId}`);
    }

    if (!this.isSupportedSource(metadata.sourceFile)) {
      throw new Error(`Unsupported source file type: ${metadata.sourceFile}`);
    }

    for (const set of metadata.variantSets) {
      if (!/^[-_a-zA-Z0-9]+$/.test(set.name)) {
        throw new Error(`Invalid variant set name: ${set.name}`);
      }
      if (!set.variants.length) {
        throw new Error(`Variant set ${set.name} must contain at least one variant.`);
      }
      for (const variant of set.variants) {
        if (!/^[-_a-zA-Z0-9]+$/.test(variant)) {
          throw new Error(`Invalid variant name: ${variant}`);
        }
      }
    }

    if (metadata.sourceFile.endsWith('.usd') || metadata.sourceFile.endsWith('.usda') || metadata.sourceFile.endsWith('.usdc')) {
      this.validateUsdIntegrity(metadata.usdIntegrity, metadata.variantSets.map((set) => set.name));
    }

    if (metadata.sourceFile.endsWith('.ktx2')) {
      this.validateKtx2Integrity(metadata.ktx2Integrity);
    }
  }

  private validateUsdIntegrity(integrity: UsdIntegrity | undefined, expectedVariantSets: string[]): void {
    if (!integrity) {
      throw new Error('USD integrity payload is required for USD source assets.');
    }
    if (!integrity.defaultPrim || !/^[/_a-zA-Z0-9-]+$/.test(integrity.defaultPrim)) {
      throw new Error('USD integrity defaultPrim is invalid.');
    }
    if (integrity.metersPerUnit <= 0) {
      throw new Error('USD integrity metersPerUnit must be greater than zero.');
    }

    const normalizedProvided = [...new Set(integrity.variantSets)].sort();
    const normalizedExpected = [...new Set(expectedVariantSets)].sort();
    if (normalizedProvided.join(',') !== normalizedExpected.join(',')) {
      throw new Error('USD variant set integrity mismatch.');
    }
  }

  private validateKtx2Integrity(integrity: Ktx2Integrity | undefined): void {
    if (!integrity) {
      throw new Error('KTX2 integrity payload is required for .ktx2 source assets.');
    }

    if (integrity.identifier !== '«KTX 20»\r\n\x1A\n') {
      throw new Error('Invalid KTX2 identifier magic.');
    }

    if (integrity.vkFormat < 0) {
      throw new Error('KTX2 vkFormat must be a non-negative integer.');
    }

    if (integrity.pixelWidth <= 0 || integrity.pixelHeight <= 0) {
      throw new Error('KTX2 dimensions must be positive.');
    }

    if (integrity.levelCount <= 0) {
      throw new Error('KTX2 levelCount must be greater than zero.');
    }
  }

  private isSupportedSource(sourceFile: string): boolean {
    return ['.fbx', '.usd', '.usda', '.usdc', '.ktx2'].some((extension) => sourceFile.endsWith(extension));
  }

  private buildPath(assetId: string, set: string, variant: string): string {
    const safeSegments = [this.buildRoot, assetId, set, variant].filter(Boolean);
    return safeSegments.join('/');
  }
}
