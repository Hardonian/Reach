pub mod artifacts;
pub mod capsule;
pub mod policy;
pub mod state;
pub mod tools;
pub mod workflow;

use std::collections::VecDeque;
use std::time::Duration;

use anyhow::Context;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::policy::{Capability, Decision, Policy};
use crate::state::{RunEvent, RunStatus, StateTransitionError};
use crate::tools::{ToolCall, ToolResult};
use crate::workflow::{StepKind, Workflow};

/// Maximum number of pending events before we reject further actions.
const MAX_PENDING_EVENTS: usize = 10_000;

/// Maximum workflow JSON payload size (16 MiB).
const MAX_WORKFLOW_SIZE: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EngineConfig {
    pub strict_schema: bool,
}

#[derive(Debug, Clone)]
pub struct Engine {
    config: EngineConfig,
}

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("workflow parse failed: {0}")]
    Parse(String),
    #[error("state transition failed: {0}")]
    Transition(#[from] StateTransitionError),
    #[error("budget exceeded: spent {spent:.4} of {limit:.4} USD")]
    BudgetExceeded { spent: f64, limit: f64 },
    #[error("step timeout: step {step_id} exceeded {timeout_ms}ms")]
    StepTimeout { step_id: String, timeout_ms: u64 },
    #[error("run timeout: elapsed {elapsed_ms}ms exceeds {limit_ms}ms")]
    RunTimeout { elapsed_ms: u64, limit_ms: u64 },
}

/// Controls that govern execution behaviour for a run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionControls {
    /// Maximum number of steps before the run is automatically stopped.
    #[serde(default)]
    pub max_steps: Option<usize>,
    /// Per-step timeout. If a step exceeds this, the run fails.
    #[serde(default)]
    pub step_timeout: Option<Duration>,
    /// Total run timeout. If the run exceeds this, it is cancelled.
    #[serde(default)]
    pub run_timeout: Option<Duration>,
    /// Budget limit in USD. The run is paused when the budget is exceeded.
    #[serde(default)]
    pub budget_limit_usd: Option<f64>,
    /// Minimum delay between consecutive steps (rate limiting).
    #[serde(default)]
    pub min_step_interval: Option<Duration>,
}

impl Default for ExecutionControls {
    fn default() -> Self {
        Self {
            max_steps: None,
            step_timeout: None,
            run_timeout: None,
            budget_limit_usd: None,
            min_step_interval: None,
        }
    }
}

/// Tracks budget consumption for a run.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BudgetTracker {
    pub spent_usd: f64,
    pub reserved_usd: f64,
    pub step_costs: Vec<StepCost>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepCost {
    pub step_id: String,
    pub cost_usd: f64,
}

impl BudgetTracker {
    #[must_use]
    pub fn total_committed(&self) -> f64 {
        self.spent_usd + self.reserved_usd
    }

    pub fn reserve(&mut self, amount: f64) {
        if amount.is_nan() || amount.is_infinite() || amount < 0.0 {
            return; // Reject invalid amounts silently
        }
        self.reserved_usd += amount;
    }

    pub fn commit(&mut self, step_id: String, actual_cost: f64) {
        if actual_cost.is_nan() || actual_cost.is_infinite() || actual_cost < 0.0 {
            return; // Reject invalid costs silently
        }
        self.reserved_usd = (self.reserved_usd - actual_cost).max(0.0);
        self.spent_usd += actual_cost;
        self.step_costs.push(StepCost {
            step_id,
            cost_usd: actual_cost,
        });
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunHandle {
    workflow: Workflow,
    policy: Policy,
    status: RunStatus,
    current_node_id: String,
    pending_events: VecDeque<RunEvent>,
    controls: ExecutionControls,
    budget: BudgetTracker,
    steps_executed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    ToolCall(ToolCall),
    EmitArtifact(crate::artifacts::Patch),
    Done,
    Paused { reason: String },
    Cancelled { reason: String },
    Error { message: String },
}

impl Engine {
    #[must_use]
    pub fn new(config: EngineConfig) -> Self {
        Self { config }
    }

    pub fn compile(&self, workflow_dsl_or_json: &str) -> Result<Workflow, EngineError> {
        if workflow_dsl_or_json.len() > MAX_WORKFLOW_SIZE {
            return Err(EngineError::Parse(format!(
                "workflow exceeds maximum size of {} bytes",
                MAX_WORKFLOW_SIZE
            )));
        }
        serde_json::from_str::<Workflow>(workflow_dsl_or_json)
            .with_context(|| {
                if self.config.strict_schema {
                    "strict schema validation rejected workflow"
                } else {
                    "failed to parse workflow JSON"
                }
            })
            .map_err(|err| EngineError::Parse(err.to_string()))
    }

    pub fn start_run(&self, workflow: Workflow, policy: Policy) -> Result<RunHandle, EngineError> {
        self.start_run_with_controls(workflow, policy, ExecutionControls::default())
    }

    pub fn start_run_with_controls(
        &self,
        workflow: Workflow,
        policy: Policy,
        controls: ExecutionControls,
    ) -> Result<RunHandle, EngineError> {
        let mut handle = RunHandle {
            workflow,
            policy,
            status: RunStatus::Created,
            current_node_id: "".to_string(),
            pending_events: VecDeque::new(),
            controls,
            budget: BudgetTracker::default(),
            steps_executed: 0,
        };
        handle.transition(RunStatus::Running)?;
        Ok(handle)
    }
}

impl RunHandle {
    #[must_use]
    pub fn status(&self) -> &RunStatus {
        &self.status
    }

    #[must_use]
    pub fn controls(&self) -> &ExecutionControls {
        &self.controls
    }

    #[must_use]
    pub fn budget(&self) -> &BudgetTracker {
        &self.budget
    }

    #[must_use]
    pub fn steps_executed(&self) -> usize {
        self.steps_executed
    }

    /// Pause the run. Only valid when the run is in the `Running` state.
    pub fn pause(&mut self, reason: &str) -> Result<(), EngineError> {
        self.transition(RunStatus::Paused {
            reason: reason.to_owned(),
        })?;
        Ok(())
    }

    /// Resume a paused run. Only valid when the run is in the `Paused` state.
    pub fn resume(&mut self) -> Result<(), EngineError> {
        self.transition(RunStatus::Running)?;
        Ok(())
    }

    /// Cancel the run. Valid from `Running` or `Paused` states.
    pub fn cancel(&mut self, reason: &str) -> Result<(), EngineError> {
        self.transition(RunStatus::Cancelled {
            reason: reason.to_owned(),
        })?;
        Ok(())
    }

    /// Record a cost against the run's budget and check the budget limit.
    pub fn record_cost(
        &mut self,
        step_id: String,
        cost_usd: f64,
    ) -> Result<(), EngineError> {
        self.budget.commit(step_id, cost_usd);

        if let Some(limit) = self.controls.budget_limit_usd {
            if self.budget.spent_usd >= limit {
                let _ = self.transition(RunStatus::Paused {
                    reason: format!(
                        "budget exceeded: spent ${:.4} of ${:.4}",
                        self.budget.spent_usd, limit
                    ),
                });
                return Err(EngineError::BudgetExceeded {
                    spent: self.budget.spent_usd,
                    limit,
                });
            }
        }
        Ok(())
    }

    pub fn next_action(&mut self) -> Action {
        if matches!(self.status, RunStatus::Failed { .. }) {
            return Action::Error {
                message: "run already failed".to_owned(),
            };
        }
        if matches!(self.status, RunStatus::Completed) {
            return Action::Done;
        }
        if let RunStatus::Paused { ref reason } = self.status {
            return Action::Paused {
                reason: reason.clone(),
            };
        }
        if let RunStatus::Cancelled { ref reason } = self.status {
            return Action::Cancelled {
                reason: reason.clone(),
            };
        }

        // Check max steps limit
        if let Some(max_steps) = self.controls.max_steps {
            if self.steps_executed >= max_steps {
                let reason = format!("max steps reached: {max_steps}");
                let _ = self.transition(RunStatus::Cancelled {
                    reason: reason.clone(),
                });
                return Action::Cancelled { reason };
            }
        }

        let Some(step) = self.workflow.steps.get(self.current_step) else {
            if self.transition(RunStatus::Completed).is_err() {
                return Action::Error {
                    message: "unable to complete run".to_owned(),
                };
            }
            return Action::Done;
        };

        match &step.kind {
            StepKind::ToolCall { tool, input } => {
                let required_capabilities = vec![Capability::ToolUse {
                    name: tool.name.clone(),
                }];
                if let Some(reason) = self.first_denied_reason(&required_capabilities) {
                    let message = format!("policy denied tool call {}: {reason}", tool.name);
                    self.push_event(RunEvent::PolicyDenied {
                        step_id: step.id.clone(),
                        call: ToolCall {
                            step_id: step.id.clone(),
                            tool_name: tool.name.clone(),
                            required_capabilities,
                            input: input.clone(),
                        },
                        reason: reason.clone(),
                    });
                    let _ = self.transition(RunStatus::Failed {
                        reason: message.clone(),
                    });
                    return Action::Error { message };
                }

                self.push_event(RunEvent::ToolCallRequested {
                    step_id: step.id.clone(),
                    call: ToolCall {
                        step_id: step.id.clone(),
                        tool_name: tool.name.clone(),
                        required_capabilities: required_capabilities.clone(),
                        input: input.clone(),
                    },
                });
                Action::ToolCall(ToolCall {
                    step_id: step.id.clone(),
                    tool_name: tool.name.clone(),
                    required_capabilities,
                    input: input.clone(),
                })
            }
            StepKind::EmitArtifact { patch } => {
                self.push_event(RunEvent::ArtifactEmitted {
                    step_id: step.id.clone(),
                    patch: patch.clone(),
                });
                self.current_step += 1;
                self.steps_executed += 1;
                Action::EmitArtifact(patch.clone())
            }
        }
    }

    pub fn apply_tool_result(&mut self, tool_result: ToolResult) -> Result<(), EngineError> {
        if !matches!(self.status, RunStatus::Running) {
            return Err(EngineError::Transition(StateTransitionError::Invalid {
                from: self.status.clone(),
                to: RunStatus::Running,
            }));
        }

        self.push_event(RunEvent::ToolCallCompleted {
            step_id: tool_result.step_id.clone(),
            result: tool_result,
        });
        self.current_step += 1;
        self.steps_executed += 1;
        Ok(())
    }

    #[must_use]
    pub fn drain_events(&mut self) -> Vec<RunEvent> {
        self.pending_events.drain(..).collect()
    }

    fn first_denied_reason(&self, required_capabilities: &[Capability]) -> Option<String> {
        for capability in required_capabilities {
            if let Decision::Deny(reason) = self.policy.evaluate(capability) {
                return Some(reason);
            }
        }
        None
    }

    fn push_event(&mut self, event: RunEvent) {
        if self.pending_events.len() >= MAX_PENDING_EVENTS {
            // Drop oldest events to stay within bounds — consumers should drain regularly.
            self.pending_events.pop_front();
        }
        self.pending_events.push_back(event);
    }

    fn transition(&mut self, target: RunStatus) -> Result<(), StateTransitionError> {
        let event = self.status.transition(&target)?;
        self.status = target;
        self.push_event(event);
        Ok(())
    }
}
