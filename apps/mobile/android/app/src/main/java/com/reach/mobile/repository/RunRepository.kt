package com.reach.mobile.repository

import com.reach.mobile.data.Run
import com.reach.mobile.data.RunEvent
import com.reach.mobile.data.RunStatus
import com.reach.mobile.network.RunnerHttpClient
import com.reach.mobile.network.RunnerSseClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

class RunRepository(
    private val httpClient: RunnerHttpClient = RunnerHttpClient(),
    private val sseClient: RunnerSseClient = RunnerSseClient(),
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) {
    private val _runs = MutableStateFlow<List<Run>>(emptyList())
    val runs: StateFlow<List<Run>> = _runs.asStateFlow()

    private val _activeRunId = MutableStateFlow<String?>(null)
    val activeRunId: StateFlow<String?> = _activeRunId.asStateFlow()

    private val _events = MutableStateFlow<List<RunEvent>>(emptyList())
    val events: StateFlow<List<RunEvent>> = _events.asStateFlow()

    private var currentStream: AutoCloseable? = null

    fun runCommand(command: String) {
        if (command.isBlank()) return

        scope.launch {
            val pendingRunId = UUID.randomUUID().toString()
            _runs.update { existing ->
                listOf(
                    Run(
                        id = pendingRunId,
                        command = command,
                        status = RunStatus.RUNNING,
                        output = listOf("Submitting command...")
                    )
                ) + existing
            }
            _activeRunId.value = pendingRunId

            val result = httpClient.createRun(command)
            result.fold(
                onSuccess = { response ->
                    val runId = response.runId
                    _activeRunId.value = runId
                    _runs.update { list ->
                        list.map { run ->
                            if (run.id == pendingRunId) run.copy(id = runId, output = listOf("Command accepted."))
                            else run
                        }
                    }

                    currentStream?.close()
                    currentStream = sseClient.streamRun(
                        runId = runId,
                        onEvent = { event ->
                            _events.update { it + event }
                            _runs.update { list ->
                                list.map { run ->
                                    if (run.id == runId) run.copy(output = run.output + event.payload)
                                    else run
                                }
                            }
                        },
                        onError = { throwable ->
                            _runs.update { list ->
                                list.map { run ->
                                    if (run.id == runId) {
                                        run.copy(
                                            status = RunStatus.FAILED,
                                            output = run.output + "Stream error: ${throwable.message.orEmpty()}"
                                        )
                                    } else run
                                }
                            }
                        },
                        onComplete = {
                            _runs.update { list ->
                                list.map { run ->
                                    if (run.id == runId && run.status == RunStatus.RUNNING) {
                                        run.copy(status = RunStatus.COMPLETED)
                                    } else run
                                }
                            }
                        }
                    )
                },
                onFailure = { throwable ->
                    _runs.update { list ->
                        list.map { run ->
                            if (run.id == pendingRunId) {
                                run.copy(
                                    status = RunStatus.FAILED,
                                    output = run.output + "Submission error: ${throwable.message.orEmpty()}"
                                )
                            } else run
                        }
                    }
                }
            )
        }
    }

    fun close() {
        currentStream?.close()
        currentStream = null
    }
}
