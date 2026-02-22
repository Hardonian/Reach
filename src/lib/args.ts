export interface CliArgs {
  example: "negotiation" | "ops";
  depth: number;
  jsonOnly: boolean;
  out: string | undefined;
  seed: string | undefined;
  strict: boolean;
  packetOut: string | undefined;
  signals: string | undefined;
  catalog: string | undefined;
  voi: boolean;
  world: boolean;
  replay: string | undefined;
  case: string | undefined;
  reportOut: string | undefined;
  pack: string | undefined;
  verify: boolean;
  emitTranscript: boolean;
  cacheMode: "read" | "write" | "off";
  deterministic: boolean;
}


export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    example: "negotiation",
    depth: 2,
    jsonOnly: false,
    out: undefined,
    seed: undefined,
    strict: true,
    packetOut: undefined,
    signals: undefined,
    catalog: undefined,
    voi: false,
    world: false,
    replay: undefined,
    case: undefined,
    reportOut: undefined,
    pack: undefined,
    verify: false,
    emitTranscript: false,
    cacheMode: "write",
    deterministic: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if ((arg === "signals" || arg === "--signals") && next) {
      result.signals = next;
      i++;
    } else if (arg === "--catalog" && next) {
      result.catalog = next;
      i++;
    } else if (arg === "--example" && next) {
      if (next === "negotiation" || next === "ops") result.example = next;
      i++;
    } else if (arg === "--depth" && next) {
      const d = parseInt(next, 10);
      if (d >= 1 && d <= 5) result.depth = d;
      i++;
    } else if (arg === "--json-only") {
      result.jsonOnly = true;
    } else if (arg === "--out" && next) {
      result.out = next;
      i++;
    } else if (arg === "--seed" && next) {
      result.seed = next;
      i++;
    } else if (arg === "--strict") {
      if (next && (next === "false" || next === "0")) {
        result.strict = false;
        i++;
      }
    } else if (arg === "--packet-out" && next) {
      result.packetOut = next;
      i++;
    } else if (arg === "--voi") {
      result.voi = true;
    } else if (arg === "--world") {
      result.world = true;
    } else if (arg === "--replay" && next) {
      result.replay = next;
      i++;
    } else if (arg === "--case" && next) {
      result.case = next;
      i++;
    } else if (arg === "--report-out" && next) {
      result.reportOut = next;
      i++;
    } else if (arg === "--pack" && next) {
      result.pack = next;
      i++;
    } else if (arg === "--verify") {
      result.verify = true;
    } else if (arg === "--emit-transcript") {
      result.emitTranscript = true;
    } else if (arg === "--cache" && next) {
      if (next === "read" || next === "write" || next === "off") result.cacheMode = next;
      i++;
    } else if (arg === "--no-cache") {
      result.cacheMode = "off";
    } else if (arg === "--deterministic") {
      result.deterministic = true;
    }
  }

  return result;
}
