package com.reach.mobile.network

import com.reach.mobile.BuildConfig

object RunnerConfig {
    val baseUrl: String = BuildConfig.RUNNER_BASE_URL.trimEnd('/')
    val mockMode: Boolean = BuildConfig.RUNNER_MOCK_MODE
    val runEndpoint: String = "$baseUrl/runs"
    val eventsEndpointForRun: (String) -> String = { runId -> "$baseUrl/runs/$runId/events" }
    val policyDecisionEndpointForGate: (String, String) -> String = { runId, gateId ->
        "$baseUrl/runs/$runId/policy-gates/$gateId/decision"
    }
    val patchDecisionEndpointForPatch: (String, String) -> String = { runId, patchId ->
        "$baseUrl/runs/$runId/patches/$patchId/decision"
    }
    val workspaceFilesEndpointForRun: (String) -> String = { runId -> "$baseUrl/runs/$runId/workspace/files" }
    val workspaceFileEndpointForRun: (String) -> String = { runId -> "$baseUrl/runs/$runId/workspace/file" }
}
