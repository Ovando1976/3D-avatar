export interface DeepCloneOptions {
  /**
   * Enables cloning of functions by returning the original reference. Disabled by default
   * to surface accidental mutation bugs when prototypes leak through application code.
   */
  allowFunctions?: boolean;
}

/**
 * Recursively clones the provided value while preserving rich JavaScript types such as
 * `Date`, `Map`, `Set`, and `ArrayBuffer` instances. This utility is intentionally light-weight
 * so it can run in both Node.js and browser runtimes without relying on the `structuredClone`
 * global, which is not yet universally available in legacy environments.
 */
export function deepClone<T>(value: T, options: DeepCloneOptions = {}): T {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' && !options.allowFunctions) {
      throw new TypeError('deepClone cannot clone functions without allowFunctions enabled.');
    }
    return value;
  }

  if (value instanceof Date) {
    return new Date(value) as unknown as T;
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as unknown as T;
  }

  if (value instanceof Map) {
    const clonedMap = new Map();
    for (const [key, mapValue] of value.entries()) {
      clonedMap.set(deepClone(key, options), deepClone(mapValue, options));
    }
    return clonedMap as unknown as T;
  }

  if (value instanceof Set) {
    const clonedSet = new Set();
    for (const entry of value.values()) {
      clonedSet.add(deepClone(entry, options));
    }
    return clonedSet as unknown as T;
  }

  if (ArrayBuffer.isView(value)) {
    return new (value.constructor as any)(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item, options)) as unknown as T;
  }

  const prototype = Object.getPrototypeOf(value);
  const clone: Record<PropertyKey, unknown> = Object.create(prototype ?? Object.prototype);
  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const [key, descriptor] of Object.entries(descriptors)) {
    if ('value' in descriptor) {
      Object.defineProperty(clone, key, {
        ...descriptor,
        value: deepClone(descriptor.value, options)
      });
    } else {
      Object.defineProperty(clone, key, descriptor);
    }
  }

  return clone as T;
}
