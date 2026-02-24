import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { NodeSysCall } from "./node-syscall.js";

describe("NodeSysCall Compliance", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "reach-syscall-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("writeTextFile creates file with content identical to fs.writeFile", async () => {
    const filePath = path.join(tempDir, "test.txt");
    const content = "Hello World\nLine 2";

    await NodeSysCall.fs.writeTextFile(filePath, content);

    const actual = await fs.readFile(filePath, "utf8");
    expect(actual).toBe(content);
  });

  it("readTextFile reads file content identical to fs.readFile", async () => {
    const filePath = path.join(tempDir, "read.txt");
    const content = "Read Me";
    await fs.writeFile(filePath, content, "utf8");

    const actual = await NodeSysCall.fs.readTextFile(filePath);
    expect(actual).toBe(content);
  });

  it("exists returns true for existing file", async () => {
    const filePath = path.join(tempDir, "exists.txt");
    await fs.writeFile(filePath, "data");
    expect(await NodeSysCall.fs.exists(filePath)).toBe(true);
  });

  it("exists returns false for non-existing file", async () => {
    const filePath = path.join(tempDir, "missing.txt");
    expect(await NodeSysCall.fs.exists(filePath)).toBe(false);
  });

  it("makeDir creates directory recursively", async () => {
    const dirPath = path.join(tempDir, "deep", "nested", "dir");
    await NodeSysCall.fs.makeDir(dirPath);

    const stat = await fs.stat(dirPath);
    expect(stat.isDirectory()).toBe(true);
  });

  it("listDir returns sorted file list", async () => {
    const dirPath = path.join(tempDir, "list");
    await fs.mkdir(dirPath);
    await fs.writeFile(path.join(dirPath, "b.txt"), "b");
    await fs.writeFile(path.join(dirPath, "a.txt"), "a");
    await fs.writeFile(path.join(dirPath, "c.txt"), "c");

    const files = await NodeSysCall.fs.listDir(dirPath);
    expect(files).toEqual(["a.txt", "b.txt", "c.txt"]);
  });
});
