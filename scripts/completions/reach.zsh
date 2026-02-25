#compdef reach
# Zsh completion for Reach CLI
# Place in $fpath (e.g., /usr/local/share/zsh/site-functions/)

_reach() {
    local curcontext="$curcontext" state line
    typeset -A opt_args
    
    _arguments -C \
        '1: :_reach_commands' \
        '2: :_reach_subcommands' \
        '*:: :->args'
    
    case "$line[1]" in
        report)
            _arguments \
                '1: :_reach_report_commands'
            ;;
        presets)
            _arguments \
                '1: :_reach_presets_commands' \
                '2: :_reach_preset_names'
            ;;
        plugins)
            _arguments \
                '1: :_reach_plugins_commands'
            ;;
    esac
}

_reach_commands() {
    local commands=(
        'doctor:System health check'
        'version:Show version information'
        'demo:Run deterministic demo smoke'
        'quickstart:Alias for bootstrap'
        'bootstrap:Initialize deterministic local artifacts'
        'status:Show CLI health and config summary'
        'bugreport:Collect redacted diagnostics'
        'audit:Export/verify signed audit logs'
        'eval:Evaluate runs and regressions'
        'release-check:Check release readiness'
        'serve:Start the Reach server'
        'federation:Manage federation'
        'support:Support utilities'
        'arcade:Arcade mode'
        'capsule:Create/verify capsules'
        'proof:Verify execution proofs'
        'graph:View evidence graph'
        'packs:Search/install packs'
        'init:Initialize new project'
        'explain:Explain a decision'
        'operator:View operator dashboard'
        'pack:Pack management'
        'wizard:Guided run wizard'
        'run:Quick run a pack'
        'share:Share runs via QR/text'
        'delegate:Delegate operations'
        'verify-proof:Verify proof'
        'cost:View cost analysis'
        'metrics:View GTM and usage metrics'
        'gate:Manage release gates'
        'report:Generate/verify demo reports'
        'help:Show help'
    )
    _describe -t commands 'reach command' commands
}

_reach_subcommands() {
    case "$line[1]" in
        report)
            _reach_report_commands
            ;;
        presets)
            _reach_presets_commands
            ;;
        plugins)
            _reach_plugins_commands
            ;;
    esac
}

_reach_report_commands() {
    local commands=(
        'demo:Generate demo report'
        'verify:Verify report integrity'
    )
    _describe -t commands 'report command' commands
}

_reach_presets_commands() {
    local commands=(
        'list:List all presets'
        'apply:Apply a preset'
    )
    _describe -t commands 'presets command' commands
}

_reach_preset_names() {
    local presets=(
        'ci-cd-integration:CI/CD Integration'
        'security-review:Security Review'
        'compliance-audit:Compliance Audit'
        'plugin-development:Plugin Development'
        'policy-drift-detection:Policy Drift Detection'
        'learning-exploration:Learning & Exploration'
        'security-basics:Security Basics'
        'replay-first-ci:Replay First CI'
        'fast-path:Fast Path'
        'ci-gates:CI Gates'
    )
    _describe -t presets 'preset name' presets
}

_reach_plugins_commands() {
    local commands=(
        'scaffold:Scaffold new plugin'
        'validate:Validate plugin'
        'list:List installed plugins'
    )
    _describe -t commands 'plugins command' commands
}

compdef _reach reach
compdef _reach ./reach
