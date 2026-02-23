/**
 * src/determinism — Reach Determinism Utility Layer
 *
 * Re-exports all determinism utilities for convenient single-import access.
 *
 * @example
 * import { canonicalJson, DeterministicMap, seededRandom, HashStream } from "../../src/determinism";
 */

export {
  canonicalJson,
  canonicalJsonPretty,
  canonicalEqual,
  type JsonValue,
  type JsonObject,
  type JsonArray,
} from "./canonicalJson.js";

export {
  sortStrings,
  sortNumbers,
  sortByKey,
  sortByNumericKey,
  sortWith,
  sortedEntries,
  sortedKeys,
} from "./deterministicSort.js";

export { DeterministicMap } from "./deterministicMap.js";

export { seededRandom, type SeededRng } from "./seededRandom.js";

export {
  HashStream,
  hashString,
  hashBuffer,
  hashReadableStream,
  combineHashes,
} from "./hashStream.js";

export { codePointCompare, byStringKey, chainCompare } from "./deterministicCompare.js";
