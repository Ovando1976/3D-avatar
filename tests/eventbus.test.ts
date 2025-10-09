import { describe, it, expect } from "vitest";
import { EventBus } from "../src/lib/EventBus.js";

type Events = {
  hello: [name: string];
  num: [n: number];
};

describe("EventBus", () => {
  it("subscribes and emits", () => {
    const bus = new EventBus<Events>();
    let seen = "";
    const off = bus.on("hello", (name) => (seen = name));
    bus.emit("hello", "world");
    expect(seen).toBe("world");
    off();
    bus.emit("hello", "ignored");
    expect(seen).toBe("world");
  });

  it("once only fires once", () => {
    const bus = new EventBus<Events>();
    let count = 0;
    bus.once("num", () => count++);
    bus.emit("num", 1);
    bus.emit("num", 2);
    expect(count).toBe(1);
  });
});