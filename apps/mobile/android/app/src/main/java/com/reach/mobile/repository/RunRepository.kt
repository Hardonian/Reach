package com.reach.mobile.repository

import android.content.Context
import androidx.datastore.core.updateData
import com.reach.mobile.data.ArtifactRecord
import com.reach.mobile.data.ProtocolEventParser
import com.reach.mobile.data.Run
import com.reach.mobile.data.RunStatus
import com.reach.mobile.data.StreamEvent
import com.reach.mobile.network.MockRunnerGateway
import com.reach.mobile.network.RealRunnerGateway
import com.reach.mobile.network.RunnerConfig
import com.reach.mobile.network.RunnerGateway
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

class RunRepository(
    context: Context,
    private val gateway: RunnerGateway = if (RunnerConfig.mockMode) MockRunnerGateway() else RealRunnerGateway(),
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) {
    private val dataStore = context.runStateDataStore

    private val _runs = MutableStateFlow<List<Run>>(emptyList())
    val runs: StateFlow<List<Run>> = _runs.asStateFlow()

    private val _activeRunId = MutableStateFlow<String?>(null)
    val activeRunId: StateFlow<String?> = _activeRunId.asStateFlow()

    private val _events = MutableStateFlow<List<StreamEvent>>(emptyList())
    val events: StateFlow<List<StreamEvent>> = _events.asStateFlow()

    private val _commandHistory = MutableStateFlow<List<String>>(emptyList())
    val commandHistory: StateFlow<List<String>> = _commandHistory.asStateFlow()

    private val _streamInfo = MutableStateFlow<String?>(null)
    val streamInfo: StateFlow<String?> = _streamInfo.asStateFlow()

    private val lastEventIds = mutableMapOf<String, String>()
    private var streamJob: Job? = null

    init {
        scope.launch {
            val persisted = dataStore.data.first()
            _runs.value = persisted.runs
            _events.value = persisted.events
            _commandHistory.value = persisted.commandHistory
            lastEventIds.putAll(persisted.lastEventIds)
            _activeRunId.value = persisted.runs.firstOrNull { it.status == RunStatus.RUNNING }?.id
        }
    }

    fun runCommand(command: String) {
        if (command.isBlank()) return

        scope.launch {
            val pendingRunId = UUID.randomUUID().toString()
            _runs.update {
                listOf(
                    Run(
                        id = pendingRunId,
                        command = command,
                        status = RunStatus.RUNNING,
                        output = listOf("Submitting command..."),
                        artifacts = emptyList()
                    )
                ) + it
            }
            _commandHistory.update { (listOf(command) + it).distinct().take(50) }
            persist()

            val result = gateway.createRun(command)
            result.fold(
                onSuccess = { response ->
                    val runId = response.runId
                    _activeRunId.value = runId
                    _runs.update { runs ->
                        runs.map { run ->
                            if (run.id == pendingRunId) run.copy(id = runId, output = listOf("Command accepted.")) else run
                        }
                    }
                    persist()
                    startStream(runId)
                },
                onFailure = { throwable ->
                    _runs.update { runs ->
                        runs.map { run ->
                            if (run.id == pendingRunId) {
                                run.copy(
                                    status = RunStatus.FAILED,
                                    output = run.output + "Submission error: ${throwable.message.orEmpty()}"
                                )
                            } else run
                        }
                    }
                    persist()
                }
            )
        }
    }

    private fun startStream(runId: String) {
        streamJob?.cancel()
        streamJob = scope.launch {
            gateway.streamRun(
                runId = runId,
                initialLastEventId = lastEventIds[runId],
                onEvent = { event ->
                    _events.update { current ->
                        if (current.any { it.eventId == event.eventId && it.runId == event.runId }) current else current + event
                    }
                    lastEventIds[runId] = event.eventId
                    applyEventToRun(event)
                    persist()
                },
                onInfo = { info ->
                    _streamInfo.value = info
                    _runs.update { runs ->
                        runs.map { run -> if (run.id == runId) run.copy(output = run.output + info) else run }
                    }
                    persist()
                },
                onError = { throwable ->
                    _runs.update { runs ->
                        runs.map { run ->
                            if (run.id == runId && run.status == RunStatus.RUNNING) {
                                run.copy(output = run.output + "Stream issue: ${throwable.message.orEmpty()}")
                            } else run
                        }
                    }
                    persist()
                },
                onComplete = {
                    _runs.update { runs ->
                        runs.map { run ->
                            if (run.id == runId && run.status == RunStatus.RUNNING) run.copy(status = RunStatus.COMPLETED)
                            else run
                        }
                    }
                    persist()
                },
                onLastEventId = { eventId ->
                    lastEventIds[runId] = eventId
                    persist()
                },
                isActive = { streamJob?.isActive == true }
            )
        }
    }

    private fun applyEventToRun(event: StreamEvent) {
        _runs.update { runs ->
            runs.map { run ->
                if (run.id != event.runId) return@map run
                val parsed = ProtocolEventParser.decode(event.raw)
                when {
                    parsed is com.reach.mobile.data.ArtifactCreatedEvent -> {
                        val record = ArtifactRecord(parsed.payload.artifactId, parsed.payload.path, parsed.payload.mimeType)
                        if (record.id.isNotBlank() && run.artifacts.none { it.id == record.id }) {
                            run.copy(artifacts = run.artifacts + record, output = run.output + "Artifact: ${parsed.payload.path}")
                        } else run
                    }
                    parsed is com.reach.mobile.data.RunCompletedEvent -> {
                        val mapped = when (parsed.payload.status) {
                            "failed" -> RunStatus.FAILED
                            "cancelled" -> RunStatus.CANCELLED
                            else -> RunStatus.COMPLETED
                        }
                        run.copy(status = mapped, output = run.output + "Run completed with status=${parsed.payload.status}")
                    }
                    else -> run.copy(output = run.output + "(${event.type}) ${event.payload}")
                }
            }
        }
    }

    private fun persist() {
        scope.launch {
            dataStore.updateData {
                PersistedRunState(
                    runs = _runs.value,
                    events = _events.value.takeLast(500),
                    lastEventIds = lastEventIds.toMap(),
                    commandHistory = _commandHistory.value
                )
            }
        }
    }

    fun close() {
        streamJob?.cancel()
        streamJob = null
    }
}
