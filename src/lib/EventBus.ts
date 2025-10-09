// src/lib/EventBus.ts

/**
 * Lightweight, strongly-typed event bus without external deps.
 * - Does NOT require an index signature on the event map type.
 * - Keeps precise tuple typing per event key.
 */
type AnyFn = (...args: any[]) => void;

// Extract only string keys from an object's keys
type StringKeys<T> = Extract<keyof T, string>;

// Resolve the argument tuple for a given event key.
// If Events[E] isn't an array/tuple, fall back to any[].
type ArgsOf<Events, E extends keyof Events> =
  Events[E] extends any[] ? Events[E] : any[];

export class EventBus<Events extends object> {
  private listeners: Map<StringKeys<Events>, Set<AnyFn>> = new Map();

  on<E extends StringKeys<Events>>(event: E, listener: (...args: ArgsOf<Events, E>) => void) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as AnyFn);
    return () => this.off(event, listener);
  }

  once<E extends StringKeys<Events>>(event: E, listener: (...args: ArgsOf<Events, E>) => void) {
    const wrapper: AnyFn = (...args: unknown[]) => {
      this.off(event, wrapper as any);
      (listener as AnyFn)(...args);
    };
    return this.on(event, wrapper as any);
  }

  off<E extends StringKeys<Events>>(event: E, listener: (...args: ArgsOf<Events, E>) => void) {
    const set = this.listeners.get(event);
    if (set) set.delete(listener as AnyFn);
  }

  emit<E extends StringKeys<Events>>(event: E, ...args: ArgsOf<Events, E>) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    // clone to avoid mutation during emit
    [...set].forEach((fn) => fn(...(args as unknown[])));
  }

  removeAllListeners(event?: StringKeys<Events>) {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

export type InferEventKeys<T> = Extract<keyof T, string>;
export type InferEventArgs<T, K extends keyof T> = T[K] extends any[] ? T[K] : never;