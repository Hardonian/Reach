/**
 * Sample Export Hook Plugin
 *
 * Adds extra metadata file to export bundle deterministically.
 * DETERMINISTIC: Same run → same metadata content.
 */

module.exports = {
  register() {
    return {
      renderers: [
        {
          id: "export-metadata-renderer",
          name: "Export Bundle Metadata Renderer",
          formats: ["export-bundle"],
          deterministic: true,

          /**
           * Render additional files for export bundle
           * @param {Object} run - Run data to export
           * @returns {Array} Additional files to include
           */
          render(run) {
            if (!run || !run.id) {
              return [];
            }

            // Generate deterministic metadata
            const metadata = {
              // Core metadata
              export_format_version: "1.0.0",
              plugin_generated_by: "sample-export-hook",
              plugin_version: "1.0.0",

              // Run info
              source_run_id: run.id,
              exported_at: new Date().toISOString(),

              // Deterministic fingerprint of plugin contribution
              plugin_fingerprint: this._generateFingerprint(run),

              // Summary statistics
              statistics: this._calculateStats(run),

              // Tags and categorization
              tags: this._generateTags(run),

              // Cross-references (deterministic order)
              cross_references: this._generateCrossRefs(run),

              // Audit trail entry
              audit_entry: {
                action: "export_bundle_enhanced",
                actor: "sample-export-hook",
                timestamp: new Date().toISOString(),
                details: {
                  files_added: 1,
                  deterministic: true,
                },
              },
            };

            // Return additional file for bundle
            return [
              {
                filename: "plugin-metadata.json",
                content: JSON.stringify(metadata, null, 2),
                content_type: "application/json",
                generated_by: "sample-export-hook",
              },
            ];
          },

          /**
           * Generate deterministic fingerprint for this plugin's contribution
           * @private
           */
          _generateFingerprint(run) {
            // Deterministic hash of plugin contribution
            const components = [
              run.id,
              run.fingerprint || "",
              "sample-export-hook",
              "1.0.0",
            ].sort(); // Sort for determinism

            const content = components.join("|");
            // Simple hash for demonstration (use proper hash in production)
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
              const char = content.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash;
            }
            return `plugin_fp_${Math.abs(hash).toString(16).padStart(8, "0")}`;
          },

          /**
           * Calculate run statistics (deterministic)
           * @private
           */
          _calculateStats(run) {
            const events = run.events || [];
            const evidence = run.evidence || [];

            // Count event types (deterministic - sorted keys)
            const eventTypes = {};
            events.forEach((e) => {
              const type = e.type || "unknown";
              eventTypes[type] = (eventTypes[type] || 0) + 1;
            });

            return {
              total_events: events.length,
              total_evidence_items: evidence.length,
              event_type_breakdown: Object.entries(eventTypes)
                .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
                .reduce((obj, [key, val]) => {
                  obj[key] = val;
                  return obj;
                }, {}),
              has_fingerprint: !!run.fingerprint,
              has_signature: !!run.signature,
              duration_ms: run.duration_ms || null,
            };
          },

          /**
           * Generate tags (deterministic)
           * @private
           */
          _generateTags(run) {
            const tags = ["exported", "plugin-enhanced"];

            if (run.deterministic) tags.push("deterministic");
            if (run.fingerprint) tags.push("fingerprinted");
            if (run.signature) tags.push("signed");
            if ((run.events || []).length > 10) tags.push("complex");
            else tags.push("simple");

            // Sort for determinism
            return tags.sort();
          },

          /**
           * Generate cross-references (deterministic)
           * @private
           */
          _generateCrossRefs(run) {
            const refs = [];

            if (run.source_junction) {
              refs.push({
                type: "source_junction",
                id: run.source_junction,
                relationship: "derived_from",
              });
            }

            if (run.parent_run_id) {
              refs.push({
                type: "parent_run",
                id: run.parent_run_id,
                relationship: "child_of",
              });
            }

            if (run.replay_of) {
              refs.push({
                type: "original_run",
                id: run.replay_of,
                relationship: "replay_of",
              });
            }

            // Sort by type for determinism
            return refs.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
          },
        },

        // Additional renderer for human-readable summary
        {
          id: "export-summary-text",
          name: "Export Text Summary Renderer",
          formats: ["export-bundle"],
          deterministic: true,

          render(run) {
            if (!run || !run.id) return [];

            const lines = [
              "# Reach Export Bundle Summary",
              "",
              `**Run ID:** ${run.id}`,
              `**Status:** ${run.status || "unknown"}`,
              `**Fingerprint:** ${run.fingerprint ? run.fingerprint.slice(0, 16) + "..." : "none"}`,
              "",
              "## Statistics",
              `- Events: ${(run.events || []).length}`,
              `- Evidence items: ${(run.evidence || []).length}`,
              `- Deterministic: ${run.deterministic ? "Yes" : "No"}`,
              "",
              "## Files in Bundle",
              "- manifest.json",
              "- events.jsonl",
              "- fingerprint.sha256",
              "- plugin-metadata.json (added by sample-export-hook)",
              "- README.txt (this file)",
              "",
              "---",
              "*Generated by sample-export-hook v1.0.0*",
            ];

            return [
              {
                filename: "README.txt",
                content: lines.join("\n"),
                content_type: "text/plain",
                generated_by: "sample-export-hook",
              },
            ];
          },
        },
      ],
    };
  },
};
