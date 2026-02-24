import { Command } from "commander";
import { trust } from "./commands/trust.js";

export const program = new Command();

program
  .name("reach")
  .description("Reach CLI - Deterministic Execution Fabric")
  .version("0.1.0");

program.addCommand(trust);

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse(process.argv);
}
