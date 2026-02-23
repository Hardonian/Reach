// @ts-ignore
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { env } from "../env";

export class CloudDisabledError extends Error {
  constructor() {
    super("REACH_CLOUD_ENABLED is not set. Cloud features disabled.");
  }
}

export function isCloudEnabled(): boolean {
  return env.REACH_CLOUD_ENABLED === true;
}

const DB_PATH = env.CLOUD_DB_PATH ?? path.join(process.cwd(), "reach-cloud.db");

let _db: Database.Database | undefined;

export function getDB(): Database.Database {
  if (!isCloudEnabled()) throw new CloudDisabledError();
  if (_db) return _db;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  return _db;
}
