import * as fs from 'fs';

let content = fs.readFileSync('services/runner/cmd/reachctl/main.go', 'utf8');

// 1. Remove the imports of `reach/decision-engine/services/runner/internal/consensus`
content = content.replace(/"reach\/decision-engine\/services\/runner\/internal\/consensus"\s*?\n/g, '');
content = content.replace(/reach\/decision-engine\/services\/runner\/internal\/consensus/g, '');

// 2. Remove runVerifyPeer, runConsensus, runPeer, loadDeterminismConfidence, runByzantine
// They are towards the end of the file. So we can just slice them off! Let's check where runVerifyPeer starts.
let index = content.indexOf('func runVerifyPeer');
if (index !== -1) {
  content = content.slice(0, index);
}

// Ensure the slice didn't cut off anything we need. 
// wait, looking at my view_file above:
// runVerifyPeer is at 5146. It is followed by runConsensus 5271, runPeer 5344, loadDeterminismConfidence 5401, runByzantine 5420.
// Is there anything after runByzantine? Let me check.
