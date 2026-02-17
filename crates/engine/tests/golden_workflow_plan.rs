use engine::{policy::Policy, state::RunEvent, tools::ToolResult, Action, Engine, EngineConfig};

#[test]
fn deterministic_event_sequence_for_simple_workflow() {
    let workflow_json = r#"
    {
      "id": "wf-1",
      "version": "v0",
      "steps": [
        {
          "id": "step-1",
          "kind": {
            "type": "tool_call",
            "tool": {
              "name": "echo",
              "description": "echo input",
              "input_schema": {"type": "object"},
              "output_schema": {"type": "object"}
            },
            "input": {"message": "hi"}
          }
        },
        {
          "id": "step-2",
          "kind": {
            "type": "emit_artifact",
            "patch": {
              "diffs": [
                {
                  "path": "note.txt",
                  "before": "old",
                  "after": "new"
                }
              ]
            }
          }
        }
      ]
    }
    "#;

    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(workflow_json).expect("compile workflow");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start run");

    let first = run.next_action();
    assert!(matches!(first, Action::ToolCall(_)));

    run.apply_tool_result(ToolResult {
        step_id: "step-1".to_owned(),
        tool_name: "echo".to_owned(),
        output: serde_json::json!({"message": "hi"}),
        success: true,
        error: None,
    })
    .expect("apply tool result");

    let second = run.next_action();
    assert!(matches!(second, Action::EmitArtifact(_)));

    let done = run.next_action();
    assert!(matches!(done, Action::Done));

    let events = run.drain_events();
    let expected = vec![
        RunEvent::RunStarted,
        RunEvent::ToolCallRequested {
            step_id: "step-1".to_owned(),
            call: engine::tools::ToolCall {
                step_id: "step-1".to_owned(),
                tool_name: "echo".to_owned(),
                input: serde_json::json!({"message": "hi"}),
            },
        },
        RunEvent::ToolCallCompleted {
            step_id: "step-1".to_owned(),
            result: ToolResult {
                step_id: "step-1".to_owned(),
                tool_name: "echo".to_owned(),
                output: serde_json::json!({"message": "hi"}),
                success: true,
                error: None,
            },
        },
        RunEvent::ArtifactEmitted {
            step_id: "step-2".to_owned(),
            patch: engine::artifacts::Patch {
                diffs: vec![engine::artifacts::Diff {
                    path: "note.txt".to_owned(),
                    before: "old".to_owned(),
                    after: "new".to_owned(),
                }],
            },
        },
        RunEvent::RunCompleted,
    ];

    assert_eq!(events, expected);
}
