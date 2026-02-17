package com.reach.mobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.reach.mobile.data.ArtifactRecord
import com.reach.mobile.repository.RunRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update

data class TerminalUiState(
    val input: String = "",
    val activeRunId: String? = null,
    val history: List<String> = emptyList(),
    val outputLines: List<String> = emptyList(),
    val artifacts: List<ArtifactRecord> = emptyList(),
    val completionSuggestions: List<String> = emptyList(),
    val streamInfo: String? = null
)

class TerminalViewModel(application: Application) : AndroidViewModel(application) {
    private val runRepository: RunRepository = RunRepository(application.applicationContext)
    private val inputText = MutableStateFlow("")

    val uiState: StateFlow<TerminalUiState> = combine(
        inputText,
        runRepository.runs,
        runRepository.activeRunId,
        runRepository.events,
        runRepository.commandHistory,
        runRepository.streamInfo
    ) { input, runs, activeRunId, events, commandHistory, streamInfo ->
        val history = runs.map { run -> "[${run.status}] ${run.command}" }
        val activeRun = runs.firstOrNull { it.id == activeRunId }
        val runOutput = activeRun?.output.orEmpty()
        val streamedEventLines = events
            .filter { event -> activeRunId != null && event.runId == activeRunId }
            .map { event -> "(${event.type}) ${event.raw}" }

        val suggestions = commandHistory
            .filter { it.startsWith(input, ignoreCase = true) && it != input }
            .take(4)

        TerminalUiState(
            input = input,
            activeRunId = activeRunId,
            history = history,
            outputLines = runOutput + streamedEventLines,
            artifacts = activeRun?.artifacts.orEmpty(),
            completionSuggestions = suggestions,
            streamInfo = streamInfo
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), TerminalUiState())

    fun onInputChanged(value: String) {
        inputText.value = value
    }

    fun applySuggestion(suggestion: String) {
        inputText.value = suggestion
    }

    fun submit() {
        val command = inputText.value.trim()
        if (command.isEmpty()) return
        runRepository.runCommand(command)
        inputText.update { "" }
    }

    override fun onCleared() {
        runRepository.close()
        super.onCleared()
    }
}
