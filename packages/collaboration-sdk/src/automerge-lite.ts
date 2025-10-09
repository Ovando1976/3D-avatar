export type MutableDoc<T> = T;
export type Doc<T> = T;

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value as T;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function init<T>(): MutableDoc<T> {
  return {} as T;
}

export function from<T>(state: T): MutableDoc<T> {
  return deepClone(state);
}

export function change<T>(doc: MutableDoc<T>, mutation: (draft: MutableDoc<T>) => void): MutableDoc<T> {
  const draft = deepClone(doc);
  mutation(draft);
  return draft;
}

export function merge<T>(local: MutableDoc<T>, remote: Doc<T>): MutableDoc<T> {
  void local;
  return deepClone(remote);
}

export function toJS<T>(doc: MutableDoc<T>): T {
  return deepClone(doc);
}
