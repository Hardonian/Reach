package com.reach.mobile.network

import com.reach.mobile.data.RunEvent
import okhttp3.OkHttpClient
import okhttp3.Request

class RunnerSseClient(
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    fun streamRun(
        runId: String,
        onEvent: (RunEvent) -> Unit,
        onError: (Throwable) -> Unit,
        onComplete: () -> Unit
    ): AutoCloseable {
        val request = Request.Builder()
            .url(RunnerConfig.eventsEndpointForRun(runId))
            .header("Accept", "text/event-stream")
            .build()

        val call = httpClient.newCall(request)

        val thread = Thread {
            try {
                call.execute().use { response ->
                    if (!response.isSuccessful) {
                        error("SSE stream failed: ${response.code}")
                    }
                    val source = response.body?.source() ?: error("Missing stream body")
                    var pendingType = "message"
                    while (!source.exhausted() && !Thread.currentThread().isInterrupted) {
                        val rawLine = source.readUtf8Line() ?: break
                        if (rawLine.startsWith("event:")) {
                            pendingType = rawLine.removePrefix("event:").trim()
                        } else if (rawLine.startsWith("data:")) {
                            val payload = rawLine.removePrefix("data:").trim()
                            onEvent(RunEvent(runId = runId, type = pendingType, payload = payload))
                        } else if (rawLine.isBlank()) {
                            pendingType = "message"
                        }
                    }
                }
                onComplete()
            } catch (t: Throwable) {
                if (!Thread.currentThread().isInterrupted) {
                    onError(t)
                }
            }
        }

        thread.name = "reach-sse-$runId"
        thread.start()

        return AutoCloseable {
            thread.interrupt()
            call.cancel()
        }
    }
}
