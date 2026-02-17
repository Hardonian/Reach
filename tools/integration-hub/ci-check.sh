#!/usr/bin/env bash
set -euo pipefail
node -e 'for (const f of ["protocol/integrations/oauth-client.schema.json","protocol/integrations/webhook-event.schema.json","protocol/integrations/notification.schema.json","protocol/integrations/integration-manifest.schema.json"]) JSON.parse(require("fs").readFileSync(f,"utf8")); console.log("integration schemas parsed")'
(cd services/integration-hub && go test ./...)
