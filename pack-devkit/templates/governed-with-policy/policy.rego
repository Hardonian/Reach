# Reach Policy Contract for {{PACK_NAME}}
# This policy controls access to tools and resources

package reach.policy

# Default deny all
default allow = false

# Allow if pack is properly signed
allow {
    input.pack_signed == true
    input.signature_valid == true
}

# Deny high-risk permissions without additional verification
deny_high_risk {
    input.requested_permission == "sys:exec"
    not input.verified_publisher
}

deny_high_risk {
    input.requested_permission == "sys:admin"
    not input.verified_publisher
}

# Allow specific tools
allow_tool["echo"]
allow_tool["read_file"]
allow_tool["write_file"]

tool_allowed(tool) {
    allow_tool[tool]
}

# Decision reason
reason = "pack_signed_and_valid" {
    allow
}

reason = "pack_not_signed" {
    not input.pack_signed
}

reason = "high_risk_permission_denied" {
    deny_high_risk
}
