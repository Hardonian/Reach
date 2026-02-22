// @ts-nocheck
import { resolve } from "node:path";

async function loadCore() {
    const mod = await import("@zeo/core");
    return mod;
}

function value(argv: string[], flag: string): string | null {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] ?? null : null;
}

export async function runGraphCommand(argv: string[]): Promise<number> {
    const [entity, action] = argv;
    const mod = await loadCore();
    const {
        buildGraph,
        detectCycles,
        calculateFragility,
        getBlastRadius,
        envelopeFilesInDir,
        loadEnvelopeFromFile
    } = mod;

    // We scan the current directory for all transcripts to build the graph context
    const cwd = process.cwd();
    const files = envelopeFilesInDir(cwd);

    if (files.length === 0) {
        console.error("No transcript envelopes found in current directory.");
        return 1;
    }

    const transcripts = files.map(f => {
        const env = loadEnvelopeFromFile(f);
        return env.transcript;
    });

    // Cast to FinalizedDecisionTranscript[] as the type from core might differ slightly in strictness
    const graph = buildGraph(transcripts as any[]);

    // Check for cycles first as they invalidate the graph logic generally
    const cycles = detectCycles(graph);
    if (cycles.length > 0) {
        console.warn("WARNING: Cycles detected in decision graph:");
        console.warn(JSON.stringify(cycles, null, 2));
        // We don't exit for 'show' but maybe strictly for 'fragility'?
        // Requirement: "DAG only (detect and reject cycles)".
        // So if cycles, maybe we should reject.
        if (action === "fragility" || action === "impact") {
            console.error("Cannot compute reliable metrics on cyclic graph.");
            return 1;
        }
    }

    if (action === "show") {
        const targetHash = argv[2];
        if (!targetHash) throw new Error("Usage: zeo graph show <transcript_hash_or_file>");

        let hash = targetHash;
        // If it looks like a file path (ends in .json), try to load it to get the hash
        if (targetHash.endsWith(".json")) {
            try {
                const env = loadEnvelopeFromFile(resolve(cwd, targetHash));
                hash = env.transcript_hash;
            } catch (e) {
                // ignore, assume it's a hash
            }
        }

        const node = graph.nodes.get(hash);
        if (!node) {
            console.error(`Transcript with hash or from file '${targetHash}' not found in graph.`);
            return 1;
        }

        console.log(JSON.stringify({
            id: node.id,
            dependencies: node.dependencies,
            dependents: node.dependents,
            blast_radius: getBlastRadius(graph, node.id).length
        }, null, 2));
        return 0;
    }

    if (action === "impact") {
        const targetHash = argv[2];
        if (!targetHash) throw new Error("Usage: zeo graph impact <transcript_hash_or_file>");

        let hash = targetHash;
        if (targetHash.endsWith(".json")) {
            try {
                const env = loadEnvelopeFromFile(resolve(cwd, targetHash));
                hash = env.transcript_hash;
            } catch {
                // If not a valid envelope file, treat input as a transcript hash.
            }
        }

        const impacted = getBlastRadius(graph, hash);
        console.log(JSON.stringify({
            transcript_hash: hash,
            impact_count: impacted.length,
            impacted_transcripts: impacted
        }, null, 2));
        return 0;
    }

    if (action === "fragility") {
        const ranking = calculateFragility(graph);
        console.log(JSON.stringify(ranking, null, 2));
        return 0;
    }

    console.error(`Unknown graph action: ${action}`);
    return 1;
}

