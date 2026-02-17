package com.reach.mobile.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.Serializer
import androidx.datastore.dataStore
import com.reach.mobile.data.Run
import com.reach.mobile.data.StreamEvent
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.io.OutputStream

private const val RUN_STORE_FILE = "reach_run_store.json"

@Serializable
data class PersistedRunState(
    val runs: List<Run> = emptyList(),
    val events: List<StreamEvent> = emptyList(),
    val lastEventIds: Map<String, String> = emptyMap(),
    val commandHistory: List<String> = emptyList()
)

private class PersistedRunStateSerializer : Serializer<PersistedRunState> {
    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }
    override val defaultValue: PersistedRunState = PersistedRunState()

    override suspend fun readFrom(input: InputStream): PersistedRunState {
        return runCatching {
            json.decodeFromString(PersistedRunState.serializer(), input.readBytes().decodeToString())
        }.getOrDefault(defaultValue)
    }

    override suspend fun writeTo(t: PersistedRunState, output: OutputStream) {
        output.write(json.encodeToString(PersistedRunState.serializer(), t).encodeToByteArray())
    }
}

val Context.runStateDataStore: DataStore<PersistedRunState> by dataStore(
    fileName = RUN_STORE_FILE,
    serializer = PersistedRunStateSerializer()
)
