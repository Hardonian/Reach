# Reach Quick Start Guide (Non-Technical) ## What is Reach?

Reach is a tool that helps you run AI systems in a way that is:

- **Deterministic**: The same inputs always produce the same outputs
- **Auditable**: Every action is logged and can be reviewed
- **Reproducible**: You can replay any execution to verify what happened

Think of it like a "flight recorder" for AI systems - it keeps a complete record of everything that happened.

## Installation ### Option 1: Using Docker (Recommended)

If you have Docker installed, just run:

```bash
docker run -p 8787:8787 reach/reach:latest
```

### Option 2: Using npm If you have Node.js installed:

```bash
npx @reach/cli doctor
```

## Your First Workflow ### Step 1: Start the Server

```bash
# Using Docker docker run -d -p 8787:8787 -v reach-data:/data --name reach reach/reach:latest

# Or using the CLI reach serve
```

### Step 2: Check Everything is Working ```bash

reach doctor

````

You should see a message saying everything is OK.

### Step 3: Run a Demo Workflow ```bash
# Create a new run reach run --pack arcadeSafe.demo
````

This runs a safe demo workflow that demonstrates Reach's capabilities.

### Step 4: View the Results ```bash

# Get the run ID from the previous command reach explain <run-id>

````

This shows you what happened during the run.

## Creating a Time Capsule A "time capsule" is a snapshot of a run that you can save for later verification:

```bash
# Create a capsule from your run reach capsule create <run-id>

# Verify the capsule later reach capsule verify <path-to-capsule>
````

## Replaying a Run You can replay any run to verify it produces the same results:

```bash
reach capsule replay <path-to-capsule>
```

## Where Are My Files Stored? By default, Reach stores everything in:

- **Docker**: Inside the container at `/data`
- **CLI**: `./data` directory where you ran the command

To use a different location:

```bash
# Docker docker run -p 8787:8787 -v /my/custom/path:/data reach/reach:latest

# CLI reach serve --data /my/custom/path
```

## Common Issues ### "Port already in use"

Something else is using port 8787. Either stop that program or use a different port:

```bash
reach serve --port 8788
```

### "Permission denied" Your user doesn't have permission to write to the data directory:

```bash
# Fix permissions (Linux/Mac) chmod 755 data/

# Or use a different directory reach serve --data ~/reach-data
```

### "Cannot connect to server" The server isn't running. Start it with:

```bash
reach serve
```

## Next Steps - **Browse available packs**: `reach packs search`

- **Install a pack**: `reach packs install <pack-name>`
- **Check federation status**: `reach federation status`

## Getting Help If you get stuck:

1. Run `reach doctor` to check your setup
2. Look at the error message - it often suggests a fix
3. Check the logs in the `data/` directory
4. Ask for help with `reach support ask "your question"`

## Safety First Reach is designed with safety in mind:

- All runs are sandboxed
- Policies control what actions are allowed
- Everything is logged for audit
- You can always replay to verify

Start with the `arcadeSafe.demo` pack - it's designed to be completely safe to experiment with.
