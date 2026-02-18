# Reach Policy Contract for {{PACK_NAME}}
package reach.policy

# Default deny
default allow = false

# Allow if properly signed
allow {
    input.pack_signed == true
    input.signature_valid == true
}

# Allow specific tools
allow_tool["echo"]
allow_tool["read_file"]
allow_tool["hash_content"]

tool_allowed(tool) {
    allow_tool[tool]
}

reason = "pack_signed" { allow }
reason = "not_signed" { not input.pack_signed }
