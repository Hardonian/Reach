use engine::{
    policy::Policy,
    state::{RunEvent, RunStatus},
    tools::ToolResult,
    Action, Engine, EngineConfig, ExecutionControls,
};

fn simple_workflow_json() -> &'static str {
    r#"
    {
      "id": "wf-ctrl",
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
            "input": {"msg": "one"}
          }
        },
        {
          "id": "step-2",
          "kind": {
            "type": "tool_call",
            "tool": {
              "name": "echo",
              "description": "echo input",
              "input_schema": {"type": "object"},
              "output_schema": {"type": "object"}
            },
            "input": {"msg": "two"}
          }
        },
        {
          "id": "step-3",
          "kind": {
            "type": "tool_call",
            "tool": {
              "name": "echo",
              "description": "echo input",
              "input_schema": {"type": "object"},
              "output_schema": {"type": "object"}
            },
            "input": {"msg": "three"}
          }
        }
      ]
    }
    "#
}

fn tool_result(step_id: &str) -> ToolResult {
    ToolResult {
        step_id: step_id.to_owned(),
        tool_name: "echo".to_owned(),
        output: serde_json::json!({"ok": true}),
        success: true,
        error: None,
    }
}

// --- Pause / Resume / Cancel ---

#[test]
fn pause_and_resume_run() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    // Execute first step
    let action = run.next_action();
    assert!(matches!(action, Action::ToolCall(_)));
    run.apply_tool_result(tool_result("step-1")).expect("apply");

    // Pause the run
    run.pause("user requested pause").expect("pause should succeed");
    assert!(matches!(run.status(), RunStatus::Paused { .. }));

    // next_action should return Paused while paused
    let paused_action = run.next_action();
    assert!(matches!(paused_action, Action::Paused { .. }));

    // Resume and continue
    run.resume().expect("resume should succeed");
    assert!(matches!(run.status(), RunStatus::Running));

    // Should be able to continue with step-2
    let action = run.next_action();
    assert!(matches!(action, Action::ToolCall(_)));
    run.apply_tool_result(tool_result("step-2")).expect("apply");

    // Verify events include pause and resume
    let events = run.drain_events();
    let has_paused = events.iter().any(|e| matches!(e, RunEvent::RunPaused { .. }));
    let has_resumed = events.iter().any(|e| matches!(e, RunEvent::RunResumed));
    assert!(has_paused, "events should include RunPaused");
    assert!(has_resumed, "events should include RunResumed");
}

#[test]
fn cancel_running_run() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    // Execute first step
    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-1")).expect("apply");

    // Cancel the run
    run.cancel("no longer needed").expect("cancel should succeed");
    assert!(matches!(run.status(), RunStatus::Cancelled { .. }));

    // next_action should return Cancelled
    let action = run.next_action();
    assert!(matches!(action, Action::Cancelled { .. }));

    // Cannot apply tool results after cancel
    let err = run.apply_tool_result(tool_result("step-2"));
    assert!(err.is_err());

    // Verify events include cancellation
    let events = run.drain_events();
    let has_cancelled = events
        .iter()
        .any(|e| matches!(e, RunEvent::RunCancelled { .. }));
    assert!(has_cancelled, "events should include RunCancelled");
}

#[test]
fn cancel_paused_run() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-1")).expect("apply");

    // Pause then cancel
    run.pause("taking a break").expect("pause");
    run.cancel("decided to stop").expect("cancel from paused");
    assert!(matches!(run.status(), RunStatus::Cancelled { .. }));
}

#[test]
fn cannot_pause_completed_run() {
    let engine = Engine::new(EngineConfig::default());
    let workflow_json = r#"
    {
      "id": "wf-short",
      "version": "v0",
      "steps": [
        {
          "id": "step-1",
          "kind": {
            "type": "tool_call",
            "tool": {
              "name": "noop",
              "description": "noop",
              "input_schema": {"type": "object"},
              "output_schema": {"type": "object"}
            },
            "input": {}
          }
        }
      ]
    }
    "#;

    let workflow = engine.compile(workflow_json).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-1")).expect("apply");
    let _ = run.next_action(); // triggers completion

    assert!(matches!(run.status(), RunStatus::Completed));
    assert!(run.pause("too late").is_err());
}

#[test]
fn cannot_resume_running_run() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    // Already running, resume should fail
    assert!(run.resume().is_err());
}

// --- Max Steps ---

#[test]
fn max_steps_cancels_run() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let controls = ExecutionControls {
        max_steps: Some(2),
        ..Default::default()
    };
    let mut run = engine
        .start_run_with_controls(workflow, Policy::default(), controls)
        .expect("start");

    // Step 1
    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-1")).expect("apply");

    // Step 2
    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-2")).expect("apply");

    // Step 3 should be cancelled due to max_steps
    let action = run.next_action();
    assert!(
        matches!(action, Action::Cancelled { ref reason } if reason.contains("max steps")),
        "expected Cancelled action, got {action:?}"
    );

    assert!(matches!(run.status(), RunStatus::Cancelled { .. }));
    assert_eq!(run.steps_executed(), 2);
}

// --- Budget ---

#[test]
fn budget_exceeded_pauses_run() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let controls = ExecutionControls {
        budget_limit_usd: Some(0.05),
        ..Default::default()
    };
    let mut run = engine
        .start_run_with_controls(workflow, Policy::default(), controls)
        .expect("start");

    // Step 1
    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-1")).expect("apply");
    run.record_cost("step-1".to_owned(), 0.03).expect("record cost within budget");

    // Record more cost that exceeds budget
    let err = run.record_cost("step-1-extra".to_owned(), 0.03);
    assert!(err.is_err(), "budget exceeded should return error");

    // Run should be paused
    assert!(
        matches!(run.status(), RunStatus::Paused { ref reason } if reason.contains("budget")),
        "expected Paused with budget reason, got {:?}",
        run.status()
    );

    // Can resume after budget adjustment (hypothetically user adds more budget)
    run.resume().expect("resume after budget pause");
    assert!(matches!(run.status(), RunStatus::Running));
}

#[test]
fn budget_tracking_accumulates() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-1")).expect("apply");

    run.record_cost("step-1".to_owned(), 0.01).expect("cost 1");
    run.record_cost("extra".to_owned(), 0.02).expect("cost 2");

    let budget = run.budget();
    // Use a tolerance that accommodates floating-point accumulation error
    // (f64::EPSILON is ~2.2e-16, too strict for summed values).
    assert!((budget.spent_usd - 0.03).abs() < 1e-10);
    assert_eq!(budget.step_costs.len(), 2);
}

// --- Steps Executed Counter ---

#[test]
fn steps_executed_tracks_correctly() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    assert_eq!(run.steps_executed(), 0);

    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-1")).expect("apply");
    assert_eq!(run.steps_executed(), 1);

    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-2")).expect("apply");
    assert_eq!(run.steps_executed(), 2);

    let _ = run.next_action();
    run.apply_tool_result(tool_result("step-3")).expect("apply");
    assert_eq!(run.steps_executed(), 3);
}

// --- Status Predicates ---

#[test]
fn status_predicates() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let mut run = engine
        .start_run(workflow, Policy::default())
        .expect("start");

    // Running is active, not terminal
    assert!(run.status().is_active());
    assert!(!run.status().is_terminal());

    // Paused is active, not terminal
    run.pause("test").expect("pause");
    assert!(run.status().is_active());
    assert!(!run.status().is_terminal());

    // Cancelled is terminal, not active
    run.cancel("done").expect("cancel");
    assert!(run.status().is_terminal());
    assert!(!run.status().is_active());
}

// --- Controls Accessors ---

#[test]
fn controls_are_accessible() {
    let engine = Engine::new(EngineConfig::default());
    let workflow = engine.compile(simple_workflow_json()).expect("compile");
    let controls = ExecutionControls {
        max_steps: Some(10),
        budget_limit_usd: Some(5.0),
        ..Default::default()
    };
    let run = engine
        .start_run_with_controls(workflow, Policy::default(), controls)
        .expect("start");

    assert_eq!(run.controls().max_steps, Some(10));
    assert_eq!(run.controls().budget_limit_usd, Some(5.0));
    assert!(run.controls().step_timeout.is_none());
    assert!(run.controls().run_timeout.is_none());
    assert!(run.controls().min_step_interval.is_none());
}

// --- State Transitions ---

#[test]
fn transition_created_to_running() {
    let status = RunStatus::Created;
    let event = status
        .transition(&RunStatus::Running)
        .expect("Created -> Running should work");
    assert!(matches!(event, RunEvent::RunStarted));
}

#[test]
fn transition_running_to_paused() {
    let status = RunStatus::Running;
    let event = status
        .transition(&RunStatus::Paused {
            reason: "test".to_owned(),
        })
        .expect("Running -> Paused should work");
    assert!(matches!(event, RunEvent::RunPaused { .. }));
}

#[test]
fn transition_paused_to_running() {
    let status = RunStatus::Paused {
        reason: "test".to_owned(),
    };
    let event = status
        .transition(&RunStatus::Running)
        .expect("Paused -> Running should work");
    assert!(matches!(event, RunEvent::RunResumed));
}

#[test]
fn transition_running_to_cancelled() {
    let status = RunStatus::Running;
    let event = status
        .transition(&RunStatus::Cancelled {
            reason: "no longer needed".to_owned(),
        })
        .expect("Running -> Cancelled should work");
    assert!(matches!(event, RunEvent::RunCancelled { .. }));
}

#[test]
fn transition_paused_to_cancelled() {
    let status = RunStatus::Paused {
        reason: "test".to_owned(),
    };
    let event = status
        .transition(&RunStatus::Cancelled {
            reason: "done".to_owned(),
        })
        .expect("Paused -> Cancelled should work");
    assert!(matches!(event, RunEvent::RunCancelled { .. }));
}

#[test]
fn transition_completed_to_paused_fails() {
    let status = RunStatus::Completed;
    let result = status.transition(&RunStatus::Paused {
        reason: "too late".to_owned(),
    });
    assert!(result.is_err());
}

#[test]
fn transition_cancelled_to_running_fails() {
    let status = RunStatus::Cancelled {
        reason: "done".to_owned(),
    };
    let result = status.transition(&RunStatus::Running);
    assert!(result.is_err());
}
