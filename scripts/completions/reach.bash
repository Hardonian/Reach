#!/bin/bash
# Bash completion for Reach CLI
# Source this file or copy to /etc/bash_completion.d/

_reach() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    local commands="doctor audit eval release-check serve federation support arcade capsule proof graph packs init explain operator pack wizard run share delegate verify-proof cost metrics gate report quickstart status help"
    
    # Report subcommands
    local report_commands="demo verify"
    
    case "${prev}" in
        reach)
            COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
            return 0
            ;;
        report)
            COMPREPLY=( $(compgen -W "${report_commands}" -- ${cur}) )
            return 0
            ;;
        presets)
            COMPREPLY=( $(compgen -W "list apply" -- ${cur}) )
            return 0
            ;;
        plugins)
            COMPREPLY=( $(compgen -W "scaffold validate list" -- ${cur}) )
            return 0
            ;;
        apply)
            # Suggest preset names
            local presets="ci-cd-integration security-review compliance-audit plugin-development policy-drift-detection learning-exploration security-basics replay-first-ci fast-path ci-gates"
            COMPREPLY=( $(compgen -W "${presets} --dry-run --yes" -- ${cur}) )
            return 0
            ;;
    esac
    
    # Common flags for all commands
    local flags="--help --json --verbose"
    
    if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${flags}" -- ${cur}) )
        return 0
    fi
}

complete -F _reach reach
complete -F _reach ./reach
