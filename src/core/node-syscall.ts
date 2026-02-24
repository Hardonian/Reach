import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { SysCall } from "./syscall.js";

/**
 * NodeSysCall
 *
 * Implementation of the Core SysCall interface using native Node.js APIs.
 * This resides in Layer 2 (Services) and is injected into Layer 1 (Core).
 */
export const NodeSysCall: SysCall = {
  fs: {
    readTextFile: async (path: string): Promise<string> => {
      return readFile(path, "utf8");
    },
    writeTextFile: async (path: string, data: string): Promise<void> => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data, "utf8");
    },
    exists: async (path: string): Promise<boolean> => {
      try {
        await access(path, constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
    listDir: async (path: string): Promise<string[]> => {
      const files = await readdir(path);
      return files.sort();
    },
    makeDir: async (path: string): Promise<void> => {
      await mkdir(path, { recursive: true });
    },
  },
};
