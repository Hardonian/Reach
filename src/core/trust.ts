import { Command } from "commander";
import { resolve } from "node:path";
import { compactTrustProfiles, deriveTrustTier } from "../../core/shim.js";

export const trust = new Command("trust");

trust
  .description("Manage trust profiles and reputation")
  .action(() => {
    trust.help();
  });

trust
  .command("list")
  .description("List all trust profiles")
  .option("-d, --dir <path>", "Trust profile root directory", ".")
  .action(async (opts) => {
    const root = resolve(process.cwd(), opts.dir);
    try {
      const profiles = await compactTrustProfiles(root);

      if (profiles.length === 0) {
        console.log("No trust profiles found.");
        return;
      }

      console.table(
        profiles.map((p) => ({
          ID: p.subject_id,
          Type: p.subject_type,
          Tier: deriveTrustTier(p),
          Pass: p.pass_count,
          Fail: p.fail_count,
        }))
      );
    } catch (err: any) {
      console.error("Error listing trust profiles:", err.message);
      process.exit(1);
    }
  });

trust
  .command("verify <subjectId>")
  .description("Check the trust tier of a specific subject")
  .option("-d, --dir <path>", "Trust profile root directory", ".")
  .action(async (subjectId, opts) => {
    const root = resolve(process.cwd(), opts.dir);
    try {
      const profiles = await compactTrustProfiles(root);
      const profile = profiles.find((p) => p.subject_id === subjectId);

      if (!profile) {
        console.log(`Subject '${subjectId}' not found.`);
        console.log("Tier: unknown");
        return;
      }

      const tier = deriveTrustTier(profile);
      console.log(`Subject: ${profile.subject_id}`);
      console.log(`Tier:    ${tier}`);
      console.log(`Stats:   ${profile.pass_count} pass / ${profile.fail_count} fail`);
    } catch (err: any) {
      console.error("Error verifying subject:", err.message);
      process.exit(1);
    }
  });
