# Recipe G: Add a Safe CLI Extension Command

Extend the Reach CLI with new subcommands that follow safety patterns.

## Overview

**Time:** 25 minutes  
**Difficulty:** Intermediate  
**Capability:** CLI extension via script

## What You'll Build

A new CLI command `reach report demo` for generating demo reports.

## Step-by-Step

### 1. Create the Script

Create `scripts/my-command.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Safe CLI Extension Example
 *
 * Follows Reach CLI patterns:
 * - Consistent exit codes
 * - JSON output option
 * - Deterministic when possible
 * - No secrets required
 */

import { exitCodes } from "../src/cli/exit-codes";

interface Options {
  json: boolean;
  output?: string;
}

function main(): void {
  const args = process.argv.slice(2);
  const options: Options = {
    json: args.includes("--json"),
    output: args.find((_, i) => args[i - 1] === "--output"),
  };

  try {
    const result = runCommand(options);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.message);
    }

    process.exit(exitCodes.SUCCESS);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (options.json) {
      console.log(JSON.stringify({ error: message }));
    } else {
      console.error(`Error: ${message}`);
    }

    process.exit(exitCodes.GENERIC_FAILURE);
  }
}

function runCommand(options: Options): { message: string; success: boolean } {
  // Your logic here
  return {
    message: "Command executed successfully",
    success: true,
  };
}

main();
```

### 2. Register in reach CLI

Edit `reach` bash script, add to the case statement:

```bash
mycommand)
  shift
  npx tsx scripts/my-command.ts "$@"
  ;;
```

### 3. Use Exit Codes

Create `src/cli/exit-codes.ts`:

```typescript
/**
 * Standard exit codes for Reach CLI commands
 */
export const exitCodes = {
  SUCCESS: 0,
  GENERIC_FAILURE: 1,
  INVALID_INPUT: 2,
  NOT_FOUND: 3,
  POLICY_BLOCKED: 4,
  VERIFICATION_FAILED: 5,
} as const;
```

### 4. Add Tests

Create `scripts/my-command.test.ts`:

```typescript
import { test, expect } from "vitest";
import { execSync } from "child_process";
import { exitCodes } from "../src/cli/exit-codes";

test("command exits with success on valid input", () => {
  const result = execSync("npx tsx scripts/my-command.ts --json");
  const output = JSON.parse(result.toString());
  expect(output.success).toBe(true);
});

test("command exits with correct code on error", () => {
  try {
    execSync("npx tsx scripts/my-command.ts --invalid");
    expect.fail("Should have thrown");
  } catch (error: any) {
    expect(error.status).toBe(exitCodes.INVALID_INPUT);
  }
});
```

## Key Patterns

1. **Exit Codes** - Use standard codes from exit-codes.ts
2. **JSON Mode** - Support `--json` for programmatic use
3. **Errors** - Exit with non-zero on failure
4. **Determinism** - Same input → same output

## Next Steps

- Recipe H: Formatter Extensions
- Add shell completions for your command
