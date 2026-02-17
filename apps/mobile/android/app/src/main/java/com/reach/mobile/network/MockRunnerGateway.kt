package com.reach.mobile.network

import com.reach.mobile.data.RunResponse
import com.reach.mobile.data.StreamEvent
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import java.time.Instant
import java.util.UUID

class MockRunnerGateway(
    private val json: Json = Json { ignoreUnknownKeys = true }
) : RunnerGateway {
    override suspend fun createRun(command: String): Result<RunResponse> {
        val runId = "mock-${UUID.randomUUID()}"
        return Result.success(RunResponse(runId = runId, accepted = true))
    }

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
        runCatching {
            val events = listOf(
                """{"schemaVersion":"0.1.0","eventId":"$runId-1","runId":"$runId","type":"run.started","timestamp":"${Instant.now()}","payload":{"schemaVersion":"0.1.0","initiator":"mock-runner"}}""",
                """{"schemaVersion":"0.1.0","eventId":"$runId-2","runId":"$runId","type":"tool.call","timestamp":"${Instant.now()}","payload":{"schemaVersion":"0.1.0","tool":"shell","input":"echo hello"}}""",
                """{"schemaVersion":"0.1.0","eventId":"$runId-3","runId":"$runId","type":"artifact.created","timestamp":"${Instant.now()}","payload":{"schemaVersion":"0.1.0","artifactId":"artifact-1","path":"/tmp/result.txt","mimeType":"text/plain"}}""",
                """{"schemaVersion":"0.1.0","eventId":"$runId-4","runId":"$runId","type":"run.completed","timestamp":"${Instant.now()}","payload":{"schemaVersion":"0.1.0","status":"succeeded"}}"""
            )

            val startIndex = events.indexOfFirst { it.contains(initialLastEventId ?: "") }
                .let { if (initialLastEventId.isNullOrBlank() || it == -1) 0 else it + 1 }

            events.drop(startIndex).forEachIndexed { index, raw ->
                if (!isActive()) return@forEachIndexed
                delay(500)
                val parsed = json.parseToJsonElement(raw).jsonObject
                val eventId = parsed["eventId"]?.toString()?.trim('"').orEmpty()
                onLastEventId(eventId)
                onEvent(
                    StreamEvent(
                        runId = runId,
                        eventId = eventId,
                        type = parsed["type"]?.toString()?.trim('"').orEmpty(),
                        payload = parsed["payload"]!!,
                        timestamp = parsed["timestamp"]?.toString()?.trim('"').orEmpty(),
                        raw = raw
                    )
                )
                if (index == 1) onInfo("Mock stream heartbeat")
            }
        }.onFailure(onError)
        onComplete()
    }
}
