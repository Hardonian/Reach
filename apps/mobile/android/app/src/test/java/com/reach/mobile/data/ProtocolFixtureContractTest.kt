package com.reach.mobile.data

import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProtocolFixtureContractTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun fixtures_are_parseable_and_versioned() {
        val fixtures = listOf("spawn_event.json", "guardrail_stop.json", "session_started.json", "capsule_sync.json")
        for (fixture in fixtures) {
            val root = locateRepoRoot()
            val file = File(root, "protocol/examples/$fixture")
            val parsed = json.parseToJsonElement(file.readText()) as JsonObject
            assertEquals("1.0.0", parsed["schemaVersion"]?.jsonPrimitive?.content)
            assertTrue(parsed["eventId"]?.jsonPrimitive?.content?.isNotBlank() == true)
            assertTrue(parsed["type"]?.jsonPrimitive?.content?.isNotBlank() == true)
            val payload = parsed["payload"] as JsonObject
            assertEquals("1.0.0", payload["schemaVersion"]?.jsonPrimitive?.content)
        }
    }

    private fun locateRepoRoot(): File {
        var current = File(System.getProperty("user.dir"))
        repeat(8) {
            if (File(current, "protocol/examples").exists()) return current
            current = current.parentFile ?: return@repeat
        }
        throw IllegalStateException("repo root not found from ${System.getProperty("user.dir")}")
    }
}
