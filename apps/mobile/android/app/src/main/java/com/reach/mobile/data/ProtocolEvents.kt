package com.reach.mobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
sealed interface ProtocolEvent {
    val schemaVersion: String
    val eventId: String
    val runId: String
    val type: String
    val timestamp: String
}

@Serializable
@SerialName("run.started")
data class RunStartedEvent(
    override val schemaVersion: String,
    override val eventId: String,
    override val runId: String,
    override val type: String,
    override val timestamp: String,
    val payload: RunStartedPayload
) : ProtocolEvent

@Serializable
data class RunStartedPayload(
    val schemaVersion: String,
    val initiator: String,
    val metadata: JsonObject? = null
)

@Serializable
@SerialName("tool.call")
data class ToolCallEvent(
    override val schemaVersion: String,
    override val eventId: String,
    override val runId: String,
    override val type: String,
    override val timestamp: String,
    val payload: JsonObject
) : ProtocolEvent

@Serializable
@SerialName("tool.result")
data class ToolResultEvent(
    override val schemaVersion: String,
    override val eventId: String,
    override val runId: String,
    override val type: String,
    override val timestamp: String,
    val payload: ToolResultPayload
) : ProtocolEvent

@Serializable
data class ToolResultPayload(
    val schemaVersion: String,
    val callId: String,
    val status: String,
    val output: JsonObject? = null,
    val error: ProtocolError? = null
)

@Serializable
@SerialName("artifact.created")
data class ArtifactCreatedEvent(
    override val schemaVersion: String,
    override val eventId: String,
    override val runId: String,
    override val type: String,
    override val timestamp: String,
    val payload: ArtifactPayload
) : ProtocolEvent

@Serializable
data class ArtifactPayload(
    val schemaVersion: String,
    val artifactId: String,
    val path: String,
    val mimeType: String? = null,
    val metadata: JsonObject? = null
)

@Serializable
@SerialName("run.completed")
data class RunCompletedEvent(
    override val schemaVersion: String,
    override val eventId: String,
    override val runId: String,
    override val type: String,
    override val timestamp: String,
    val payload: RunCompletedPayload
) : ProtocolEvent

@Serializable
data class RunCompletedPayload(
    val schemaVersion: String,
    val status: String,
    val error: ProtocolError? = null
)

@Serializable
data class ProtocolError(
    val message: String,
    val code: String? = null
)

@Serializable
@SerialName("policy.gate.requested")
data class PolicyGateRequestedEvent(
    override val schemaVersion: String,
    override val eventId: String,
    override val runId: String,
    override val type: String,
    override val timestamp: String,
    val payload: JsonObject
) : ProtocolEvent

@Serializable
@SerialName("policy.gate.resolved")
data class PolicyGateResolvedEvent(
    override val schemaVersion: String,
    override val eventId: String,
    override val runId: String,
    override val type: String,
    override val timestamp: String,
    val payload: JsonObject
) : ProtocolEvent
