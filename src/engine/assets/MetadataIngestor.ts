export interface VariantSet {
  name: string;
  variants: string[];
}

export interface AssetMetadata {
  assetId: string;
  sourceFile: string;
  tags: string[];
  variantSets: VariantSet[];
  dependencies: string[];
}

export interface BuildArtifact {
  assetId: string;
  bundlePath: string;
  variants: Record<string, string>;
  dependencies: string[];
  tags: string[];
}

export class MetadataIngestor {
  constructor(private readonly buildRoot: string) {
    if (!buildRoot) {
      throw new Error('buildRoot is required.');
    }
  }

  ingest(metadata: AssetMetadata): BuildArtifact {
    this.validateMetadata(metadata);
    const variants: Record<string, string> = {};
    for (const set of metadata.variantSets) {
      for (const variant of set.variants) {
        const key = `${set.name}:${variant}`;
        if (variants[key]) {
          throw new Error(`Duplicate variant entry detected: ${key}`);
        }
        variants[key] = this.buildPath(metadata.assetId, set.name, variant);
      }
    }
    return {
      assetId: metadata.assetId,
      bundlePath: this.buildPath(metadata.assetId, '', 'bundle.usdz'),
      variants,
      dependencies: [...new Set(metadata.dependencies)].sort(),
      tags: metadata.tags.map((tag) => tag.toLowerCase()).sort()
    };
  }

  private validateMetadata(metadata: AssetMetadata): void {
    if (!/^[-_a-zA-Z0-9]+$/.test(metadata.assetId)) {
      throw new Error(`Invalid asset id: ${metadata.assetId}`);
    }
    if (!metadata.sourceFile.endsWith('.fbx') && !metadata.sourceFile.endsWith('.usd')) {
      throw new Error(`Unsupported source file type: ${metadata.sourceFile}`);
    }
    for (const set of metadata.variantSets) {
      if (!set.variants.length) {
        throw new Error(`Variant set ${set.name} must contain at least one variant.`);
      }
      for (const variant of set.variants) {
        if (!/^[-_a-zA-Z0-9]+$/.test(variant)) {
          throw new Error(`Invalid variant name: ${variant}`);
        }
      }
    }
  }

  private buildPath(assetId: string, set: string, variant: string): string {
    const safeSegments = [this.buildRoot, assetId, set, variant].filter(Boolean);
    return safeSegments.join('/');
  }
}
