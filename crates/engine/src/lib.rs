//! Deterministic workflow engine core.

pub mod artifacts;
pub mod events;
pub mod ir;
pub mod policy;
pub mod state_machine;

pub use artifacts::ArtifactRef;
pub use events::{EngineEvent, EventKind};
pub use ir::{NodeKind, Workflow, WorkflowNode};
pub use policy::{Decision, ExecutionPolicy, PolicyError};
pub use state_machine::{MachineError, MachineState, WorkflowMachine};
