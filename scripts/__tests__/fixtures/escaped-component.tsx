// Test fixture: Uses forbidden term but with inline escape hatch
export function GlossaryEntry() {
  return (
    <div>
      <h2>Internal Terminology Reference</h2>
      {/* canonical-language: allow */}
      <p>
        DAG stands for Directed Acyclic Graph. In Reach, this is called a
        workflow.
      </p>
    </div>
  );
}
