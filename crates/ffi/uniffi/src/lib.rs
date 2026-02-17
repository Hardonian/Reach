use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use engine::{
    policy::Policy, tools::ToolResult, workflow::Workflow, Engine, EngineConfig, RunHandle,
};
use once_cell::sync::Lazy;
use thiserror::Error;

static ENGINES: Lazy<Mutex<HashMap<u64, Engine>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static RUNS: Lazy<Mutex<HashMap<u64, RunHandle>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Error, uniffi::Error)]
pub enum FfiError {
    #[error("unknown engine id")]
    UnknownEngine,
    #[error("unknown run id")]
    UnknownRun,
    #[error("serialization error")]
    Serialization,
    #[error("engine error")]
    Engine,
    #[error("lock poisoned")]
    LockPoisoned,
}

#[uniffi::export]
pub fn create_engine() -> Result<u64, FfiError> {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let mut engines = ENGINES.lock().map_err(|_| FfiError::LockPoisoned)?;
    engines.insert(id, Engine::new(EngineConfig::default()));
    Ok(id)
}

#[uniffi::export]
pub fn compile_workflow(engine_id: u64, workflow_json: String) -> Result<String, FfiError> {
    let engines = ENGINES.lock().map_err(|_| FfiError::LockPoisoned)?;
    let engine = engines.get(&engine_id).ok_or(FfiError::UnknownEngine)?;
    let workflow = engine
        .compile(&workflow_json)
        .map_err(|_| FfiError::Engine)?;
    serde_json::to_string(&workflow).map_err(|_| FfiError::Serialization)
}

#[uniffi::export]
pub fn start_run(
    engine_id: u64,
    workflow_json: String,
    policy_json: String,
) -> Result<u64, FfiError> {
    let workflow: Workflow =
        serde_json::from_str(&workflow_json).map_err(|_| FfiError::Serialization)?;
    let policy: Policy = serde_json::from_str(&policy_json).map_err(|_| FfiError::Serialization)?;

    let engines = ENGINES.lock().map_err(|_| FfiError::LockPoisoned)?;
    let engine = engines.get(&engine_id).ok_or(FfiError::UnknownEngine)?;
    let run = engine
        .start_run(workflow, policy)
        .map_err(|_| FfiError::Engine)?;
    drop(engines);

    let run_id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let mut runs = RUNS.lock().map_err(|_| FfiError::LockPoisoned)?;
    runs.insert(run_id, run);
    Ok(run_id)
}

#[uniffi::export]
pub fn next_action(run_id: u64) -> Result<String, FfiError> {
    let mut runs = RUNS.lock().map_err(|_| FfiError::LockPoisoned)?;
    let run = runs.get_mut(&run_id).ok_or(FfiError::UnknownRun)?;
    let action = run.next_action();
    serde_json::to_string(&action).map_err(|_| FfiError::Serialization)
}

#[uniffi::export]
pub fn apply_tool_result(run_id: u64, tool_result_json: String) -> Result<String, FfiError> {
    let tool_result: ToolResult =
        serde_json::from_str(&tool_result_json).map_err(|_| FfiError::Serialization)?;

    let mut runs = RUNS.lock().map_err(|_| FfiError::LockPoisoned)?;
    let run = runs.get_mut(&run_id).ok_or(FfiError::UnknownRun)?;
    run.apply_tool_result(tool_result)
        .map_err(|_| FfiError::Engine)?;
    serde_json::to_string(&run.drain_events()).map_err(|_| FfiError::Serialization)
}

uniffi::setup_scaffolding!();
