package com.reach.mobile.network

import com.reach.mobile.data.RunResponse
import com.reach.mobile.data.StreamEvent

interface RunnerGateway {
    suspend fun createRun(command: String): Result<RunResponse>
    suspend fun streamRun(
        runId: String,
        initialLastEventId: String?,
        onEvent: (StreamEvent) -> Unit,
        onInfo: (String) -> Unit,
        onError: (Throwable) -> Unit,
        onComplete: () -> Unit,
        onLastEventId: (String) -> Unit,
        isActive: () -> Boolean
    )

    suspend fun submitPolicyDecision(runId: String, gateId: String, decision: String): Result<Unit>
    suspend fun submitPatchDecision(runId: String, patchId: String, decision: String): Result<Unit>
    suspend fun fetchWorkspaceFiles(runId: String): Result<List<String>>
    suspend fun fetchWorkspaceFile(runId: String, path: String): Result<String>
    suspend fun stopAutonomous(runId: String): Result<Unit>
}
