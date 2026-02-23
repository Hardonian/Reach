// @ts-nocheck
import { describe, it, expect } from "vitest";
import { __private__ } from "./plugins-cli.js";

describe("plugins cli", () => {
  it("discovers plugin manifests", () => {
    const manifests = __private__.loadPluginManifests();
    const ids = manifests.map((m) => m.manifest.id);
    expect(ids).toContain("sample-deterministic-plugin");
  });
});
