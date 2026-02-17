package com.reach.mobile.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

object ProtocolEventParser {
    private val json = Json { ignoreUnknownKeys = true }

    fun decode(raw: String): ProtocolEvent? {
        val obj = json.parseToJsonElement(raw) as? JsonObject ?: return null
        return when (obj["type"]?.jsonPrimitive?.content) {
            "run.started" -> json.decodeFromJsonElement(RunStartedEvent.serializer(), obj)
            "tool.call" -> json.decodeFromJsonElement(ToolCallEvent.serializer(), obj)
            "tool.result" -> json.decodeFromJsonElement(ToolResultEvent.serializer(), obj)
            "artifact.created" -> json.decodeFromJsonElement(ArtifactCreatedEvent.serializer(), obj)
            "run.completed" -> json.decodeFromJsonElement(RunCompletedEvent.serializer(), obj)
            "policy.gate.requested" -> json.decodeFromJsonElement(PolicyGateRequestedEvent.serializer(), obj)
            "policy.gate.resolved" -> json.decodeFromJsonElement(PolicyGateResolvedEvent.serializer(), obj)
            else -> null
        }
    }
}
