package com.reach.mobile.sdk

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable data class HandshakeSession(val session_token: String, val expires_in_seconds: Int, val node_id: String, val org_id: String)
@Serializable data class PolicyDecision(val allowed: Boolean, val required_gate: Boolean, val missing_capabilities: List<String>)
@Serializable data class RunCreateResponse(val run_id: String)
@Serializable data class ShareTokenResponse(val token: String)
@Serializable data class TimelineEvent(val id: Long, val type: String, val payload: Map<String, String> = emptyMap(), val created_at: String)
@Serializable data class RunTimeline(val run_id: String, val timeline: List<TimelineEvent>)

class ReachClient(private val baseURL: String, private val cookie: String? = null, private val http: OkHttpClient = OkHttpClient()) {
    private val json = Json { ignoreUnknownKeys = true }
    private val media = "application/json".toMediaType()

    fun handshake(nodeId: String, orgId: String, publicKey: String, signatureProvider: (String) -> String): HandshakeSession {
        val challenge = requestMap("/v1/mobile/handshake/challenge", "{\"node_id\":\"$nodeId\",\"org_id\":\"$orgId\",\"public_key\":\"$publicKey\"}")["challenge"] ?: error("missing challenge")
        val signature = signatureProvider(challenge)
        return request("/v1/mobile/handshake/complete", "{\"challenge\":\"$challenge\",\"signature\":\"$signature\"}")
    }

    fun policyPreflight(pack: List<String>): PolicyDecision = request("/v1/mobile/policy/preflight", json.encodeToString(mapOf("capabilities" to pack)))
    fun runPack(pack: List<String>, mode: String = "arcadeSafe"): String = request<RunCreateResponse>("/v1/runs", json.encodeToString(mapOf("capabilities" to pack, "plan_tier" to if (mode == "arcadeSafe") "free" else "pro"))).run_id
    fun getRun(runId: String): RunTimeline = request("/v1/mobile/runs/$runId", null, method = "GET")
    fun createShareToken(runId: String): String = request<ShareTokenResponse>("/v1/mobile/share-tokens", json.encodeToString(mapOf("run_id" to runId))).token
    fun fetchSharedRun(token: String): RunTimeline = request("/v1/mobile/share/$token", null, method = "GET")

    private inline fun <reified T> request(path: String, body: String?, method: String = "POST"): T {
        val reqBuilder = Request.Builder().url(baseURL.trimEnd('/') + path)
        if (cookie != null) reqBuilder.header("Cookie", cookie)
        if (method == "GET") reqBuilder.get() else reqBuilder.method(method, (body ?: "{}").toRequestBody(media))
        http.newCall(reqBuilder.build()).execute().use { resp ->
            require(resp.isSuccessful) { "HTTP ${resp.code}" }
            return json.decodeFromString(resp.body!!.string())
        }
    }

    private fun requestMap(path: String, body: String): Map<String, String> = request(path, body)
}
