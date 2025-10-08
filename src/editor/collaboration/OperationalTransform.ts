import { deepClone } from '../../utils/deepClone.js';

export type OperationType = 'insert' | 'remove' | 'replace';

export interface TransformOperation {
  type: OperationType;
  path: string;
  value?: unknown;
  version: number;
  actor: string;
}

export interface TransformResult {
  version: number;
  state: unknown;
}

export type ConflictResolution = 'local' | 'remote';

export interface TransformContext {
  apply(state: unknown, operation: TransformOperation): unknown;
}

function parseSegments(path: string): (string | number)[] {
  return path
    .split('.')
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const index = Number(segment);
      return Number.isInteger(index) && segment.trim() === `${index}` ? index : segment;
    });
}

export class JsonTransformContext implements TransformContext {
  apply(state: unknown, operation: TransformOperation): unknown {
    const clone = deepClone(state);
    const segments = parseSegments(operation.path);
    if (segments.length === 0) {
      return operation.type === 'remove' ? undefined : deepClone(operation.value);
    }
    let target: any = clone;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      if (typeof segment === 'number') {
        target[segment] = target[segment] ?? [];
      } else {
        target[segment] = target[segment] ?? {};
      }
      target = target[segment];
    }
    const last = segments[segments.length - 1];
    switch (operation.type) {
      case 'insert':
      case 'replace':
        if (typeof last === 'number') {
          target[last] = operation.value;
        } else {
          target[last] = operation.value;
        }
        break;
      case 'remove':
        if (typeof last === 'number') {
          if (Array.isArray(target)) {
            target.splice(last, 1);
          }
        } else {
          delete target[last];
        }
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
    return clone;
  }
}

export class OperationalTransformEngine {
  private version = 0;
  private history: TransformOperation[] = [];
  private readonly context: TransformContext;
  private readonly maxHistory: number;

  constructor(context: TransformContext = new JsonTransformContext(), maxHistory = 512) {
    this.context = context;
    this.maxHistory = maxHistory;
  }

  get currentVersion(): number {
    return this.version;
  }

  apply(state: unknown, operation: TransformOperation, resolution: ConflictResolution = 'remote'): TransformResult {
    const adjusted = this.transformAgainstHistory(operation, resolution);
    const newState = this.context.apply(state, adjusted);
    this.version += 1;
    const recorded = { ...adjusted, version: this.version };
    this.history.push(recorded);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    return { version: this.version, state: newState };
  }

  historySince(version: number): TransformOperation[] {
    return this.history.filter((entry) => entry.version > version);
  }

  private transformAgainstHistory(operation: TransformOperation, resolution: ConflictResolution): TransformOperation {
    let adjusted: TransformOperation = { ...operation };
    for (const historical of this.history) {
      if (historical.version < adjusted.version) {
        continue;
      }
      if (historical.path === adjusted.path) {
        adjusted = this.resolveConflict(adjusted, historical, resolution);
      }
    }
    return adjusted;
  }

  private resolveConflict(
    incoming: TransformOperation,
    historical: TransformOperation,
    resolution: ConflictResolution
  ): TransformOperation {
    if (resolution === 'local') {
      return { ...incoming, value: historical.value, version: historical.version };
    }
    if (incoming.type === 'insert' && historical.type === 'insert') {
      return { ...incoming, path: `${incoming.path}.conflict${historical.version}` };
    }
    return { ...incoming, version: historical.version + 1 };
  }
}
