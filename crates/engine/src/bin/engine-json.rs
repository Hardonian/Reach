use std::io::{self, Read};

use engine::{
    policy::Policy, state::RunEvent, tools::ToolResult, Action, Engine, EngineConfig, RunHandle,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

const SCHEMA_VERSION: &str = "0.1.0";

#[derive(Debug, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
enum EngineRequest {
    CompileWorkflow {
        workflow_json: Value,
    },
    StartRun {
        workflow: engine::workflow::Workflow,
        run_id: String,
        #[serde(default = "default_initiator")]
        initiator: String,
    },
    NextAction {
        run_id: String,
        run_handle: RunHandle,
    },
    ApplyToolResult {
        run_id: String,
        run_handle: RunHandle,
        tool_result: ToolResult,
    },
}

#[derive(Debug, Serialize)]
struct EngineResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    workflow: Option<engine::workflow::Workflow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    run_handle: Option<RunHandle>,
    #[serde(default)]
    events: Vec<EventEnvelope>,
    #[serde(skip_serializing_if = "Option::is_none")]
    action: Option<Action>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct EventEnvelope {
    #[serde(rename = "schemaVersion")]
    schema_version: &'static str,
    #[serde(rename = "eventId")]
    event_id: String,
    #[serde(rename = "runId")]
    run_id: String,
    #[serde(rename = "type")]
    event_type: String,
    timestamp: String,
    payload: Value,
}

fn default_initiator() -> String {
    "runner".to_owned()
}

fn main() {
    let mut input = String::new();
    if let Err(err) = io::stdin().read_to_string(&mut input) {
        emit_error(format!("failed to read stdin: {err}"));
        return;
    }

    let request = match serde_json::from_str::<EngineRequest>(&input) {
        Ok(req) => req,
        Err(err) => {
            emit_error(format!("invalid request json: {err}"));
            return;
        }
    };

    let engine = Engine::new(EngineConfig::default());

    let response = match request {
        EngineRequest::CompileWorkflow { workflow_json } => {
            match engine.compile(&workflow_json.to_string()) {
                Ok(workflow) => EngineResponse {
                    ok: true,
                    workflow: Some(workflow),
                    run_handle: None,
                    events: vec![],
                    action: None,
                    error: None,
                },
                Err(err) => error_response(err.to_string()),
            }
        }
        EngineRequest::StartRun {
            workflow,
            run_id,
            initiator,
        } => match engine.start_run(workflow, Policy::default()) {
            Ok(mut run_handle) => {
                let events = drain_wrapped_events(&mut run_handle, &run_id, Some(initiator));
                EngineResponse {
                    ok: true,
                    workflow: None,
                    run_handle: Some(run_handle),
                    events,
                    action: None,
                    error: None,
                }
            }
            Err(err) => error_response(err.to_string()),
        },
        EngineRequest::NextAction {
            run_id,
            mut run_handle,
        } => {
            let action = run_handle.next_action();
            let events = drain_wrapped_events(&mut run_handle, &run_id, None);
            EngineResponse {
                ok: true,
                workflow: None,
                run_handle: Some(run_handle),
                events,
                action: Some(action),
                error: None,
            }
        }
        EngineRequest::ApplyToolResult {
            run_id,
            mut run_handle,
            tool_result,
        } => match run_handle.apply_tool_result(tool_result) {
            Ok(()) => {
                let events = drain_wrapped_events(&mut run_handle, &run_id, None);
                EngineResponse {
                    ok: true,
                    workflow: None,
                    run_handle: Some(run_handle),
                    events,
                    action: None,
                    error: None,
                }
            }
            Err(err) => error_response(err.to_string()),
        },
    };

    if let Err(err) = serde_json::to_writer(io::stdout(), &response) {
        emit_error(format!("failed to write response: {err}"));
    }
}

fn error_response(message: String) -> EngineResponse {
    EngineResponse {
        ok: false,
        workflow: None,
        run_handle: None,
        events: vec![],
        action: None,
        error: Some(message),
    }
}

fn emit_error(message: String) {
    let response = error_response(message);
    let _ = serde_json::to_writer(io::stdout(), &response);
}

fn drain_wrapped_events(
    run_handle: &mut RunHandle,
    run_id: &str,
    initiator: Option<String>,
) -> Vec<EventEnvelope> {
    run_handle
        .drain_events()
        .into_iter()
        .enumerate()
        .map(|(idx, event)| wrap_event(run_id, idx, event, initiator.clone()))
        .collect()
}

fn wrap_event(
    run_id: &str,
    index: usize,
    event: RunEvent,
    initiator: Option<String>,
) -> EventEnvelope {
    let event_id = format!("{run_id}-evt-{index}");
    let timestamp = "1970-01-01T00:00:00Z".to_owned();
    match event {
        RunEvent::RunStarted => EventEnvelope {
            schema_version: SCHEMA_VERSION,
            event_id,
            run_id: run_id.to_owned(),
            event_type: "run.started".to_owned(),
            timestamp,
            payload: serde_json::json!({"schemaVersion": SCHEMA_VERSION, "initiator": initiator.unwrap_or_else(default_initiator)}),
        },
        RunEvent::ToolCallRequested { call, .. } => EventEnvelope {
            schema_version: SCHEMA_VERSION,
            event_id,
            run_id: run_id.to_owned(),
            event_type: "tool.call".to_owned(),
            timestamp,
            payload: serde_json::json!({"schemaVersion": SCHEMA_VERSION, "callId": call.step_id, "toolName": call.tool_name, "input": call.input}),
        },
        RunEvent::ToolCallCompleted { result, .. } => {
            let payload = if result.success {
                serde_json::json!({"schemaVersion": SCHEMA_VERSION, "callId": result.step_id, "status": "ok", "output": result.output})
            } else {
                serde_json::json!({"schemaVersion": SCHEMA_VERSION, "callId": result.step_id, "status": "error", "error": {"message": result.error.unwrap_or_else(|| "tool failed".to_owned())}})
            };
            EventEnvelope {
                schema_version: SCHEMA_VERSION,
                event_id,
                run_id: run_id.to_owned(),
                event_type: "tool.result".to_owned(),
                timestamp,
                payload,
            }
        }
        RunEvent::PolicyDenied { reason, .. } => EventEnvelope {
            schema_version: SCHEMA_VERSION,
            event_id,
            run_id: run_id.to_owned(),
            event_type: "policy.denied".to_owned(),
            timestamp,
            payload: serde_json::json!({"schemaVersion": SCHEMA_VERSION, "reason": reason}),
        },
        RunEvent::ArtifactEmitted { patch, .. } => EventEnvelope {
            schema_version: SCHEMA_VERSION,
            event_id,
            run_id: run_id.to_owned(),
            event_type: "artifact.created".to_owned(),
            timestamp,
            payload: serde_json::to_value(patch)
                .unwrap_or_else(|_| serde_json::json!({"diffs": []})),
        },
        RunEvent::RunCompleted => EventEnvelope {
            schema_version: SCHEMA_VERSION,
            event_id,
            run_id: run_id.to_owned(),
            event_type: "run.completed".to_owned(),
            timestamp,
            payload: serde_json::json!({"schemaVersion": SCHEMA_VERSION, "status": "succeeded"}),
        },
        RunEvent::RunFailed { reason } => EventEnvelope {
            schema_version: SCHEMA_VERSION,
            event_id,
            run_id: run_id.to_owned(),
            event_type: "run.completed".to_owned(),
            timestamp,
            payload: serde_json::json!({"schemaVersion": SCHEMA_VERSION, "status": "failed", "error": {"message": reason}}),
        },
        RunEvent::RunCreated => EventEnvelope {
            schema_version: SCHEMA_VERSION,
            event_id,
            run_id: run_id.to_owned(),
            event_type: "run.started".to_owned(),
            timestamp,
            payload: serde_json::json!({"schemaVersion": SCHEMA_VERSION, "initiator": initiator.unwrap_or_else(default_initiator)}),
        },
    }
}
