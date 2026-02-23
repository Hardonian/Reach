const { execSync } = require('child_process');
const fs = require('fs');

const files = execSync('git ls-files "docs" "reach"', { stdio: 'pipe' })
  .toString()
  .split('\n')
  .map(f => f.trim())
  .filter(f => f);

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  if (f.startsWith('docs/internal/') || f.startsWith('docs/audit/') || f.startsWith('docs/migration/') || f.startsWith('docs/release/') || f.startsWith('docs/suite/')) {
    continue;
  }
  
  let content = fs.readFileSync(f, 'utf8');

  // Capsule -> Transcript
  content = content.replace(/\bCapsule\b/g, 'Transcript');
  content = content.replace(/\bcapsule\b/g, 'transcript');
  content = content.replace(/\bCapsules\b/g, 'Transcripts');
  content = content.replace(/\bcapsules\b/g, 'transcripts');

  // Blueprint -> Policy
  content = content.replace(/\bBlueprint\b/g, 'Policy');
  content = content.replace(/\bblueprint\b/g, 'policy');
  content = content.replace(/\bBlueprints\b/g, 'Policies');
  content = content.replace(/\bblueprints\b/g, 'policies');

  // Recipe -> Task
  content = content.replace(/\bRecipe\b/g, 'Task');
  content = content.replace(/\brecipe\b/g, 'task');
  content = content.replace(/\bRecipes\b/g, 'Tasks');
  content = content.replace(/\brecipes\b/g, 'tasks');

  // Envelope -> Event
  content = content.replace(/\bEnvelope\b/g, 'Event');
  content = content.replace(/\benvelope\b/g, 'event');
  content = content.replace(/\bEnvelopes\b/g, 'Events');
  content = content.replace(/\benvelopes\b/g, 'events');

  // PoEE -> Execution Proof
  content = content.replace(/\bPoEE\b/g, 'Execution Proof');
  content = content.replace(/\bPOEE\b/g, 'Execution Proof');

  // Pack-Variant -> Pack
  content = content.replace(/\bPack-Variant\b/g, 'Pack');
  content = content.replace(/\bpack-variant\b/g, 'pack');

  fs.writeFileSync(f, content, 'utf8');
}
console.log('Fixed terminology in user-facing surfaces');
