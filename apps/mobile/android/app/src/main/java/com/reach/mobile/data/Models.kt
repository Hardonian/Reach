package com.reach.mobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class RunRequest(
    @SerialName("command") val command: String
)

@Serializable
data class RunResponse(
    @SerialName("run_id") val runId: String,
    @SerialName("accepted") val accepted: Boolean
)

@Serializable
data class Run(
    val id: String,
    val command: String,
    val status: RunStatus,
    val output: List<String>,
    val artifacts: List<ArtifactRecord> = emptyList()
)

@Serializable
enum class RunStatus {
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED
}

@Serializable
data class ArtifactRecord(
    val id: String,
    val path: String,
    val mimeType: String? = null
)

@Serializable
data class StreamEvent(
    val runId: String,
    val eventId: String,
    val type: String,
    val payload: JsonElement,
    val timestamp: String,
    val raw: String
)

@Serializable
data class PolicyDecisionRequest(
    @SerialName("decision") val decision: String
)

@Serializable
data class PatchDecisionRequest(
    @SerialName("decision") val decision: String
)

@Serializable
data class WorkspaceFileListResponse(
    @SerialName("files") val files: List<String>
)

@Serializable
data class WorkspaceFileResponse(
    @SerialName("path") val path: String,
    @SerialName("content") val content: String
)
