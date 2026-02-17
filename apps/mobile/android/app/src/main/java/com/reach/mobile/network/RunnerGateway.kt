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
}
