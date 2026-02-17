use std::{
    collections::HashMap,
    ffi::{CStr, CString},
    os::raw::c_char,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use engine::{
    policy::Policy, tools::ToolResult, workflow::Workflow, Engine, EngineConfig, RunHandle,
};
use once_cell::sync::Lazy;

static ENGINES: Lazy<Mutex<HashMap<u64, Engine>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static RUNS: Lazy<Mutex<HashMap<u64, RunHandle>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn into_c_string(value: String) -> *mut c_char {
    CString::new(value)
        .expect("CString conversion must succeed")
        .into_raw()
}

unsafe fn from_c_str(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    CStr::from_ptr(ptr).to_str().ok().map(ToOwned::to_owned)
}

#[no_mangle]
pub extern "C" fn reach_engine_create() -> u64 {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    if let Ok(mut engines) = ENGINES.lock() {
        engines.insert(id, Engine::new(EngineConfig::default()));
        id
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn reach_engine_free(engine_id: u64) {
    if let Ok(mut engines) = ENGINES.lock() {
        engines.remove(&engine_id);
    }
}

#[no_mangle]
/// # Safety
/// The caller must pass valid NUL-terminated pointers owned according to the C ABI and uphold lifetime guarantees.
pub unsafe extern "C" fn reach_compile_workflow(
    engine_id: u64,
    workflow_json: *const c_char,
) -> *mut c_char {
    let Some(workflow_json) = from_c_str(workflow_json) else {
        return into_c_string("{\"error\":\"invalid workflow json\"}".to_owned());
    };

    let Ok(engines) = ENGINES.lock() else {
        return into_c_string("{\"error\":\"engine lock failed\"}".to_owned());
    };
    let Some(engine) = engines.get(&engine_id) else {
        return into_c_string("{\"error\":\"unknown engine\"}".to_owned());
    };

    match engine.compile(&workflow_json) {
        Ok(workflow) => serde_json::to_string(&workflow).map_or_else(
            |_| into_c_string("{\"error\":\"serialization failed\"}".to_owned()),
            into_c_string,
        ),
        Err(_) => into_c_string("{\"error\":\"compile failed\"}".to_owned()),
    }
}

#[no_mangle]
/// # Safety
/// The caller must pass valid NUL-terminated pointers owned according to the C ABI and uphold lifetime guarantees.
pub unsafe extern "C" fn reach_start_run(
    engine_id: u64,
    workflow_json: *const c_char,
    policy_json: *const c_char,
) -> u64 {
    let Some(workflow_json) = from_c_str(workflow_json) else {
        return 0;
    };
    let Some(policy_json) = from_c_str(policy_json) else {
        return 0;
    };

    let Ok(workflow) = serde_json::from_str::<Workflow>(&workflow_json) else {
        return 0;
    };
    let Ok(policy) = serde_json::from_str::<Policy>(&policy_json) else {
        return 0;
    };

    let Ok(engines) = ENGINES.lock() else {
        return 0;
    };
    let Some(engine) = engines.get(&engine_id) else {
        return 0;
    };
    let Ok(run) = engine.start_run(workflow, policy) else {
        return 0;
    };
    drop(engines);

    let run_id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    if let Ok(mut runs) = RUNS.lock() {
        runs.insert(run_id, run);
        run_id
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn reach_run_free(run_id: u64) {
    if let Ok(mut runs) = RUNS.lock() {
        runs.remove(&run_id);
    }
}

#[no_mangle]
pub extern "C" fn reach_next_action(run_id: u64) -> *mut c_char {
    let Ok(mut runs) = RUNS.lock() else {
        return into_c_string("{\"error\":\"run lock failed\"}".to_owned());
    };
    let Some(run) = runs.get_mut(&run_id) else {
        return into_c_string("{\"error\":\"unknown run\"}".to_owned());
    };
    serde_json::to_string(&run.next_action()).map_or_else(
        |_| into_c_string("{\"error\":\"serialization failed\"}".to_owned()),
        into_c_string,
    )
}

#[no_mangle]
/// # Safety
/// The caller must pass valid NUL-terminated pointers owned according to the C ABI and uphold lifetime guarantees.
pub unsafe extern "C" fn reach_apply_tool_result(
    run_id: u64,
    tool_result_json: *const c_char,
) -> *mut c_char {
    let Some(tool_result_json) = from_c_str(tool_result_json) else {
        return into_c_string("{\"error\":\"invalid tool result\"}".to_owned());
    };
    let Ok(tool_result) = serde_json::from_str::<ToolResult>(&tool_result_json) else {
        return into_c_string("{\"error\":\"invalid tool result\"}".to_owned());
    };

    let Ok(mut runs) = RUNS.lock() else {
        return into_c_string("{\"error\":\"run lock failed\"}".to_owned());
    };
    let Some(run) = runs.get_mut(&run_id) else {
        return into_c_string("{\"error\":\"unknown run\"}".to_owned());
    };

    if run.apply_tool_result(tool_result).is_err() {
        return into_c_string("{\"error\":\"apply failed\"}".to_owned());
    }

    serde_json::to_string(&run.drain_events()).map_or_else(
        |_| into_c_string("{\"error\":\"serialization failed\"}".to_owned()),
        into_c_string,
    )
}

#[no_mangle]
/// # Safety
/// The caller must pass valid NUL-terminated pointers owned according to the C ABI and uphold lifetime guarantees.
pub unsafe extern "C" fn reach_string_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}
