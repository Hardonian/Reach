# Policy Denial Example
# This policy denies execution of high-risk sys:exec permission

package reach.policy

# Default deny
default allow = false

# Deny sys:exec for all packs
deny_exec {
    input.requested_permission == "sys:exec"
}

# Deny if not signed
deny_not_signed {
    not input.pack_signed
}

# Only allow if explicitly permitted (which we don't do here)
allow {
    input.pack_signed == true
    input.verified_publisher == true
    not deny_exec
}

# Decision reasons
reason = "exec_permission_denied" { deny_exec }
reason = "pack_not_signed" { deny_not_signed }
reason = "publisher_not_verified" { not input.verified_publisher }
