#!/usr/bin/env python3
import json
import sys
from pathlib import Path

index_path = Path(sys.argv[1])
pkg_id = sys.argv[2]
version = sys.argv[3]
sha256 = sys.argv[4]
manifest_url = sys.argv[5]
bundle_url = sys.argv[6]
signature_url = sys.argv[7]

if index_path.exists():
    data = json.loads(index_path.read_text())
else:
    data = {"packages": []}

entry = None
for pkg in data["packages"]:
    if pkg["id"] == pkg_id:
        entry = pkg
        break
if entry is None:
    entry = {"id": pkg_id, "versions": []}
    data["packages"].append(entry)

entry["versions"] = [v for v in entry["versions"] if v["version"] != version]
entry["versions"].append({
    "version": version,
    "sha256": sha256,
    "manifest_url": manifest_url,
    "bundle_url": bundle_url,
    "signature_url": signature_url,
    "signature_key_id": "marketplace",
    "risk_level": "medium",
    "tier_required": "free"
})
entry["versions"].sort(key=lambda x: x["version"])
data["packages"].sort(key=lambda x: x["id"])
index_path.write_text(json.dumps(data, indent=2) + "\n")
