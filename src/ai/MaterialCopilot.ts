export interface MaterialNode {
  id: string;
  type: string;
  params: Record<string, number | string>;
}

export interface MaterialGraph {
  nodes: MaterialNode[];
  output: string;
}

export interface MaterialCopilotConfig {
  styleLibrary: Record<string, Partial<MaterialNode['params']>>;
  defaultColor?: string;
  curatedPalette?: string[];
}

export interface GenerateMaterialOptions {
  seed?: number;
  palette?: string[];
  emphasis?: 'roughness' | 'metallic' | 'transmission';
}

const DEFAULT_STYLE_LIBRARY: Record<string, Partial<MaterialNode['params']>> = {
  metallic: { metallic: 0.9, roughness: 0.2 },
  matte: { roughness: 0.8 },
  translucent: { transmission: 0.7, roughness: 0.1 }
};

export class MaterialCopilot {
  private readonly styleLibrary: Map<string, Partial<MaterialNode['params']>> = new Map();
  private readonly defaultColor: string;
  private readonly curatedPalette: string[];

  constructor(config: MaterialCopilotConfig = { styleLibrary: DEFAULT_STYLE_LIBRARY }) {
    this.defaultColor = config.defaultColor ?? '#ffffff';
    this.curatedPalette = config.curatedPalette ?? ['#ffffff', '#d4af37', '#c0c0c0', '#b7410e'];
    const merged = { ...DEFAULT_STYLE_LIBRARY, ...config.styleLibrary };
    for (const [key, params] of Object.entries(merged)) {
      this.registerStyle(key, params);
    }
  }

  registerStyle(name: string, params: Partial<MaterialNode['params']>): void {
    if (!name.trim()) {
      throw new Error('Style name cannot be empty.');
    }
    this.styleLibrary.set(name.toLowerCase(), { ...params });
  }

  generateGraph(prompt: string, options: GenerateMaterialOptions = {}): MaterialGraph {
    if (!prompt.trim()) {
      throw new Error('Prompt is required to generate a material graph.');
    }
    const keywords = prompt.toLowerCase().split(/\s+/);
    const palette = options.palette ?? this.curatedPalette;
    const color = this.deriveColor(keywords, palette, options.seed);
    const parameters = this.deriveParameters(keywords, options.emphasis);
    const nodes: MaterialNode[] = [
      {
        id: 'baseColor',
        type: 'ConstantColor',
        params: { color }
      },
      {
        id: 'surface',
        type: 'PrincipledBSDF',
        params: parameters
      }
    ];

    if (keywords.includes('pattern') || keywords.includes('noise')) {
      nodes.push({
        id: 'patternNoise',
        type: 'FractalNoise',
        params: { scale: 5, octaves: 4 }
      });
    }

    return { nodes, output: 'surface' };
  }

  suggestEdits(feedback: string, graph: MaterialGraph): MaterialGraph {
    const adjustments = feedback.toLowerCase();
    const clone: MaterialGraph = {
      nodes: graph.nodes.map((node) => ({ ...node, params: { ...node.params } })),
      output: graph.output
    };
    const surface = clone.nodes.find((node) => node.id === 'surface');
    if (!surface) {
      return clone;
    }
    if (adjustments.includes('shinier')) {
      surface.params.roughness = Math.max(0, Number(surface.params.roughness ?? 0.5) - 0.1);
    }
    if (adjustments.includes('duller')) {
      surface.params.roughness = Math.min(1, Number(surface.params.roughness ?? 0.5) + 0.1);
    }
    if (adjustments.includes('metal')) {
      surface.params.metallic = 0.9;
    }
    if (adjustments.includes('glass')) {
      surface.params.transmission = 0.85;
      surface.params.roughness = Math.max(0.02, Number(surface.params.roughness ?? 0.05));
    }
    return clone;
  }

  private deriveColor(keywords: string[], palette: string[], seed = Date.now()): string {
    if (keywords.includes('gold')) {
      return '#d4af37';
    }
    if (keywords.includes('silver')) {
      return '#c0c0c0';
    }
    if (keywords.includes('rust')) {
      return '#b7410e';
    }
    if (palette.length === 0) {
      return this.defaultColor;
    }
    const index = Math.abs(this.hashSeed(seed.toString())) % palette.length;
    return palette[index];
  }

  private deriveParameters(keywords: string[], emphasis?: GenerateMaterialOptions['emphasis']): Record<string, number> {
    const params: Record<string, number> = {
      metallic: 0.1,
      roughness: 0.5,
      transmission: 0
    };
    for (const keyword of keywords) {
      const style = this.styleLibrary.get(keyword);
      if (style) {
        Object.assign(params, style);
      }
    }
    if (keywords.includes('glass')) {
      params.transmission = 0.8;
      params.roughness = 0.05;
    }
    if (emphasis === 'roughness') {
      params.roughness = Math.min(1, params.roughness + 0.1);
    } else if (emphasis === 'metallic') {
      params.metallic = Math.min(1, params.metallic + 0.2);
    } else if (emphasis === 'transmission') {
      params.transmission = Math.min(1, params.transmission + 0.2);
    }
    return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Number(value.toFixed(3))]));
  }

  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
