use engine::{
    policy::{Capability, Policy, PolicyRule},
    state::RunEvent,
    Action, Engine, EngineConfig,
};

#[test]
fn denied_capability_stops_run_deterministically() {
    let workflow_json = r#"
    {
      "id": "wf-2",
      "version": "v0",
      "steps": [
        {
          "id": "step-1",
          "kind": {
            "type": "tool_call",
            "tool": {
              "name": "dangerous",
              "description": "danger",
              "input_schema": {"type": "object"},
              "output_schema": {"type": "object"}
            },
            "input": {}
          }
        }
      ]
    }
    "#;

    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(workflow_json).expect("compile workflow");
    let policy = Policy {
        rules: vec![PolicyRule {
            capability: Capability::ToolUse {
                name: "dangerous".to_owned(),
            },
            allow: false,
            reason: Some("tool blocked by policy".to_owned()),
        }],
    };

    let mut run = engine.start_run(workflow, policy).expect("start run");
    let action = run.next_action();

    assert!(matches!(
        action,
        Action::Error { message } if message.contains("tool blocked by policy")
    ));

    let done = run.next_action();
    assert!(matches!(done, Action::Error { .. }));

    let events = run.drain_events();
    assert_eq!(events[0], RunEvent::RunStarted);
    assert_eq!(
        events[1],
        RunEvent::RunFailed {
            reason: "policy denied tool call dangerous: tool blocked by policy".to_owned()
        }
    );
}
