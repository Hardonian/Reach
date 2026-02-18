# Reach Policy Contract for {{PACK_NAME}}
package reach.policy

# Default deny
default allow = false

# Allow if properly signed
allow {
    input.pack_signed == true
    input.signature_valid == true
}

# Federation-specific rules
allow_delegation {
    input.federation.delegation_allowed == true
    input.federation.trust_score >= 0.8
}

deny_delegation {
    input.federation.delegation_allowed == false
}

deny_delegation {
    input.federation.trust_score < 0.8
}

# Allow specific tools
allow_tool["echo"]
allow_tool["delegate"]

tool_allowed(tool) {
    allow_tool[tool]
}

reason = "pack_signed" { allow }
reason = "delegation_not_allowed" { deny_delegation }
