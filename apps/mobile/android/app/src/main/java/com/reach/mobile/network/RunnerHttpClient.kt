package com.reach.mobile.network

import com.reach.mobile.data.RunRequest
import com.reach.mobile.data.RunResponse
import com.reach.mobile.data.PatchDecisionRequest
import com.reach.mobile.data.PolicyDecisionRequest
import com.reach.mobile.data.WorkspaceFileListResponse
import com.reach.mobile.data.WorkspaceFileResponse
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
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

    fun submitPolicyDecision(runId: String, gateId: String, decision: String): Result<Unit> {
        return runCatching {
            val payload = json.encodeToString(PolicyDecisionRequest(decision = decision))
            val request = Request.Builder()
                .url(RunnerConfig.policyDecisionEndpointForGate(runId, gateId))
                .post(payload.toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    error("Policy decision failed ${response.code}: ${response.body?.string().orEmpty()}")
                }
            }
        }
    }

    fun submitPatchDecision(runId: String, patchId: String, decision: String): Result<Unit> {
        return runCatching {
            val payload = json.encodeToString(PatchDecisionRequest(decision = decision))
            val request = Request.Builder()
                .url(RunnerConfig.patchDecisionEndpointForPatch(runId, patchId))
                .post(payload.toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    error("Patch decision failed ${response.code}: ${response.body?.string().orEmpty()}")
                }
            }
        }
    }

    fun fetchWorkspaceFiles(runId: String): Result<List<String>> {
        return runCatching {
            val request = Request.Builder()
                .url(RunnerConfig.workspaceFilesEndpointForRun(runId))
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Workspace list failed ${response.code}: $body")
                }
                json.decodeFromString<WorkspaceFileListResponse>(body).files
            }
        }
    }

    fun fetchWorkspaceFile(runId: String, path: String): Result<String> {
        return runCatching {
            val url = RunnerConfig.workspaceFileEndpointForRun(runId)
                .toHttpUrl()
                .newBuilder()
                .addQueryParameter("path", path)
                .build()
            val request = Request.Builder().url(url).get().build()
            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Workspace file fetch failed ${response.code}: $body")
                }
                json.decodeFromString<WorkspaceFileResponse>(body).content
            }
        }
    }
    fun stopAutonomous(runId: String): Result<Unit> {
        return runCatching {
            val request = Request.Builder()
                .url(RunnerConfig.autonomousStopEndpointForRun(runId))
                .post("{}".toRequestBody("application/json".toMediaType()))
                .build()
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    error("Autonomous stop failed ${response.code}: ${response.body?.string().orEmpty()}")
                }
            }
        }
    }

}
