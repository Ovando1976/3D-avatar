// src/realtime/AvatarSession.ts
import { EventBus } from "../lib/EventBus.js";

export type VisemeWeights = Record<string, number>;
export type AvatarSessionEvents = {
  connected: [];
  disconnected: [reason?: string];
  error: [err: Error];
  partialText: [text: string];
  finalText: [text: string];
  blendShapes: [weights: VisemeWeights];
};

export type AvatarSessionOptions = { mock?: boolean };

export class AvatarSession {
  readonly events = new EventBus<AvatarSessionEvents>();
  #connected = false;
  #opts: AvatarSessionOptions;

  constructor(opts: AvatarSessionOptions = {}) {
    this.#opts = opts;
  }

  get connected() {
    return this.#connected;
  }

  async connect() {
    if (this.#connected) return;
    // Use the option so it's not “unused”
    const delayMs = this.#opts.mock ? 5 : 10;
    await new Promise((r) => setTimeout(r, delayMs));
    this.#connected = true;
    this.events.emit("connected");
  }

  async disconnect(reason?: string) {
    if (!this.#connected) return;
    this.#connected = false;
    this.events.emit("disconnected", reason);
  }

  async sendText(text: string) {
    if (!this.#connected) throw new Error("Not connected");
    this.events.emit("partialText", text.slice(0, Math.max(1, Math.floor(text.length / 2))));
    await new Promise((r) => setTimeout(r, 5));
    this.events.emit("finalText", text);
  }

  sendBlendShapes(weights: VisemeWeights) {
    if (!this.#connected) throw new Error("Not connected");
    this.events.emit("blendShapes", weights);
  }
}