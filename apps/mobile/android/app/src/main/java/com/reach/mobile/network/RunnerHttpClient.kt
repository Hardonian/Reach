package com.reach.mobile.network

import com.reach.mobile.data.RunRequest
import com.reach.mobile.data.RunResponse
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class RunnerHttpClient(
    private val httpClient: OkHttpClient = OkHttpClient(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    fun createRun(command: String): Result<RunResponse> {
        return runCatching {
            val payload = json.encodeToString(RunRequest(command))
            val request = Request.Builder()
                .url(RunnerConfig.runEndpoint)
                .post(payload.toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Runner returned ${response.code}: $body")
                }
                json.decodeFromString<RunResponse>(body)
            }
        }
    }
}
