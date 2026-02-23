# CLI Completions

Reach includes shell completion scripts for Bash, Zsh, and Fish.

## Installation

### Bash

```bash
# Option 1: Source in your .bashrc
echo 'source /path/to/reach/scripts/completions/reach.bash' >> ~/.bashrc

# Option 2: Copy to system completions
sudo cp scripts/completions/reach.bash /etc/bash_completion.d/reach
```

### Zsh

```bash
# Option 1: Add to fpath
mkdir -p ~/.zsh/completions
cp scripts/completions/reach.zsh ~/.zsh/completions/_reach

# Add to ~/.zshrc:
# fpath=(~/.zsh/completions $fpath)
# autoload -U compinit && compinit
```

### Fish

```bash
# Copy to fish completions
mkdir -p ~/.config/fish/completions
cp scripts/completions/reach.fish ~/.config/fish/completions/reach.fish
```

## Usage

After installation, completions work automatically:

```bash
# Type and press Tab
reach doc<Tab>          # completes to: doctor
reach report <Tab>      # shows: demo, verify
reach presets apply <Tab>  # shows preset names
```

## Available Completions

### Main Commands
- `doctor`, `audit`, `eval`, `serve`, `federation`, `support`
- `arcade`, `capsule`, `proof`, `graph`, `packs`, `init`
- `explain`, `operator`, `pack`, `wizard`, `run`, `share`
- `delegate`, `verify-proof`, `cost`, `metrics`, `gate`, `report`

### Report Subcommands
- `demo` - Generate demo report
- `verify` - Verify report integrity

### Presets
- All preset names for `presets apply`
- `--dry-run` and `--yes` flags

### Plugins
- `scaffold`, `validate`, `list` subcommands

### Flags
- `--help`, `--json`, `--verbose`
