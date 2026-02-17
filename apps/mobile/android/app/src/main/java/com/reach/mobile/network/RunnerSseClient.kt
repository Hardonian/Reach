package com.reach.mobile.network

import com.reach.mobile.data.StreamEvent
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import kotlin.math.min
import kotlin.random.Random

class RunnerSseClient(
    private val httpClient: OkHttpClient = OkHttpClient(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    data class StreamCallbacks(
        val onEvent: (StreamEvent) -> Unit,
        val onInfo: (String) -> Unit,
        val onError: (Throwable) -> Unit,
        val onComplete: () -> Unit,
        val onLastEventId: (String) -> Unit
    )

    suspend fun streamRun(
        runId: String,
        initialLastEventId: String?,
        callbacks: StreamCallbacks,
        isActive: () -> Boolean
    ) {
        var reconnectAttempt = 0
        var retryDelayMs = 1000L
        var lastEventId: String? = initialLastEventId

        while (isActive()) {
            val request = Request.Builder()
                .url(RunnerConfig.eventsEndpointForRun(runId))
                .header("Accept", "text/event-stream")
                .apply {
                    if (!lastEventId.isNullOrBlank()) {
                        header("Last-Event-ID", lastEventId!!)
                    }
                }
                .build()

            try {
                httpClient.newCall(request).execute().use { response ->
                    validateResponse(response)
                    reconnectAttempt = 0
                    parseSseStream(response) { eventId, data, serverRetryMs ->
                        if (!eventId.isNullOrBlank()) {
                            lastEventId = eventId
                            callbacks.onLastEventId(eventId)
                        }
                        if (serverRetryMs != null) {
                            retryDelayMs = serverRetryMs.coerceIn(500L, 30_000L)
                        }
                        if (data != null) {
                            callbacks.onEvent(parseEvent(runId, data, eventId))
                        }
                    }
                }

                if (isActive()) {
                    callbacks.onInfo("Event stream ended by server; reconnecting.")
                }
            } catch (t: Throwable) {
                if (!isActive()) break
                callbacks.onError(t)
            }

            if (!isActive()) break
            reconnectAttempt += 1
            val boundedDelay = min(30_000L, retryDelayMs * (1L shl min(reconnectAttempt, 5)))
            val jitter = Random.nextLong(from = boundedDelay / 3, until = boundedDelay)
            callbacks.onInfo("Reconnecting stream in ${jitter}ms (attempt $reconnectAttempt).")
            delay(jitter)
        }

        callbacks.onComplete()
    }

    private fun validateResponse(response: Response) {
        if (!response.isSuccessful) {
            error("SSE stream failed: ${response.code}")
        }
        val contentType = response.header("Content-Type").orEmpty()
        if (!contentType.contains("text/event-stream")) {
            error("Expected text/event-stream but got '$contentType'")
        }
    }

    private fun parseSseStream(
        response: Response,
        onFrame: (eventId: String?, data: String?, serverRetryMs: Long?) -> Unit
    ) {
        val source = response.body?.source() ?: error("Missing stream body")
        var pendingId: String? = null
        val dataLines = mutableListOf<String>()
        var serverRetryMs: Long? = null

        while (!source.exhausted()) {
            val line = source.readUtf8Line() ?: break
            when {
                line.startsWith(":") -> Unit
                line.startsWith("id:") -> pendingId = line.removePrefix("id:").trim()
                line.startsWith("data:") -> dataLines += line.removePrefix("data:").trim()
                line.startsWith("retry:") -> {
                    serverRetryMs = line.removePrefix("retry:").trim().toLongOrNull()
                }
                line.isBlank() -> {
                    val payload = dataLines.takeIf { it.isNotEmpty() }?.joinToString("\n")
                    onFrame(pendingId, payload, serverRetryMs)
                    pendingId = null
                    dataLines.clear()
                }
            }
        }

        if (dataLines.isNotEmpty()) {
            onFrame(pendingId, dataLines.joinToString("\n"), serverRetryMs)
        }
    }

    private fun parseEvent(runId: String, rawData: String, fallbackId: String?): StreamEvent {
        val obj = json.parseToJsonElement(rawData) as? JsonObject
        val eventId = obj?.get("eventId")?.jsonPrimitive?.contentOrNull ?: fallbackId.orEmpty()
        val type = obj?.get("type")?.jsonPrimitive?.contentOrNull ?: "message"
        val payload = obj?.get("payload") ?: json.parseToJsonElement("{}")
        val timestamp = obj?.get("timestamp")?.jsonPrimitive?.contentOrNull ?: ""
        val eventRunId = obj?.get("runId")?.jsonPrimitive?.contentOrNull ?: runId
        return StreamEvent(
            runId = eventRunId,
            eventId = eventId,
            type = type,
            payload = payload,
            timestamp = timestamp,
            raw = rawData
        )
    }
}
