package com.reach.mobile.network

import com.reach.mobile.data.RunResponse
import com.reach.mobile.data.StreamEvent

class RealRunnerGateway(
    private val httpClient: RunnerHttpClient = RunnerHttpClient(),
    private val sseClient: RunnerSseClient = RunnerSseClient()
) : RunnerGateway {
    override suspend fun createRun(command: String): Result<RunResponse> = httpClient.createRun(command)

    override suspend fun streamRun(
        runId: String,
        initialLastEventId: String?,
        onEvent: (StreamEvent) -> Unit,
        onInfo: (String) -> Unit,
        onError: (Throwable) -> Unit,
        onComplete: () -> Unit,
        onLastEventId: (String) -> Unit,
        isActive: () -> Boolean
    ) {
        sseClient.streamRun(
            runId = runId,
            initialLastEventId = initialLastEventId,
            callbacks = RunnerSseClient.StreamCallbacks(
                onEvent = onEvent,
                onInfo = onInfo,
                onError = onError,
                onComplete = onComplete,
                onLastEventId = onLastEventId
            ),
            isActive = isActive
        )
    }
}
