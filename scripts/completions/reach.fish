# Fish completion for Reach CLI
# Place in ~/.config/fish/completions/reach.fish

# Main commands
set -l reach_commands doctor version demo quickstart bootstrap status bugreport audit eval release-check serve federation support arcade capsule proof graph packs init explain operator pack wizard run share delegate verify-proof cost metrics gate report help

# Report subcommands
set -l report_commands demo verify

# Presets subcommands
set -l presets_commands list apply

# Plugins subcommands
set -l plugins_commands scaffold validate list

# Preset names
set -l preset_names ci-cd-integration security-review compliance-audit plugin-development policy-drift-detection learning-exploration security-basics replay-first-ci fast-path ci-gates

# Disable file completions for first argument
complete -c reach -f

# First argument: main commands
complete -c reach -n "__fish_use_subcommand" -a "$reach_commands"

# Report subcommand
complete -c reach -n "__fish_seen_subcommand_from report" -a "$report_commands"

# Presets subcommand
complete -c reach -n "__fish_seen_subcommand_from presets" -a "$presets_commands"
complete -c reach -n "__fish_seen_subcommand_from apply; and __fish_seen_subcommand_from presets" -a "$preset_names"

# Plugins subcommand
complete -c reach -n "__fish_seen_subcommand_from plugins" -a "$plugins_commands"

# Common flags
complete -c reach -s h -l help -d "Show help"
complete -c reach -l json -d "Output as JSON"
complete -c reach -l verbose -d "Verbose output"

# Preset apply flags
complete -c reach -n "__fish_seen_subcommand_from apply" -l dry-run -d "Preview changes"
complete -c reach -n "__fish_seen_subcommand_from apply" -l yes -d "Auto-confirm"
