import { describe, it, expect } from "vitest";
import { AvatarSession } from "../src/realtime/AvatarSession.js";

describe("AvatarSession", () => {
  it("connects, sends, and disconnects", async () => {
    const s = new AvatarSession({ mock: true });

    let connected = false;
    let final = "";
    s.events.on("connected", () => (connected = true));
    s.events.on("finalText", (t) => (final = t));

    await s.connect();
    expect(connected).toBe(true);

    await s.sendText("hello world");
    expect(final).toBe("hello world");

    await s.disconnect("done");
    expect(s.connected).toBe(false);
  });
});