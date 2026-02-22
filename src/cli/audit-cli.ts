import { scanDirectory, type ScanResult } from "@zeo/audit";
import { resolve } from "node:path";
import { cwd } from "node:process";

export interface AuditCliArgs {
    command: "secrets" | null;
    path?: string;
}

export function parseAuditArgs(argv: string[]): AuditCliArgs {
    // argv: [audit, secrets, <path>]
    const result: AuditCliArgs = { command: null };
    const cmd = argv[1];
    if (cmd === "secrets") {
        result.command = "secrets";
        result.path = argv[2];
    }
    return result;
}

export async function runAuditCommand(argv: string[]): Promise<number> {
    const args = parseAuditArgs(argv);

    if (args.command === "secrets") {
        const scanPath = resolve(cwd(), args.path ?? ".");
        console.log(`Scanning for secrets in: ${scanPath}`);

        // Extensions to scan? Default all text files approx
        const results = scanDirectory(scanPath, {
            recursive: true,
            ignore: [".git", "node_modules", "dist", ".zeo", "coverage"]
        });

        if (results.length === 0) {
            console.log("✓ No secrets found.");
            return 0;
        }

        console.log(`\n⚠️  Found potential secrets in ${results.length} files:`);
        let count = 0;
        for (const res of results) {
            console.log(`\n📄 ${res.file}`);
            for (const secret of res.secrets) {
                console.log(`   - [${secret.match.length} chars] ${secret.kind} at index ${secret.index}`);
                count++;
            }
        }

        console.log(`\nTotal findings: ${count}`);
        return 1; // Fail status
    }

    console.log("Usage: zeo audit secrets [path]");
    return 1;
}
