package com.reach.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
    val outputLines: List<String> = emptyList()
)

class TerminalViewModel(
    private val runRepository: RunRepository = RunRepository()
) : ViewModel() {
    private val inputText = MutableStateFlow("")

    val uiState: StateFlow<TerminalUiState> = combine(
        inputText,
        runRepository.runs,
        runRepository.activeRunId,
        runRepository.events
    ) { input, runs, activeRunId, events ->
        val history = runs.map { run -> "[${run.status}] ${run.command}" }
        val runOutput = runs.firstOrNull { it.id == activeRunId }?.output.orEmpty()
        val streamedEventLines = events
            .filter { event -> activeRunId != null && event.runId == activeRunId }
            .map { event -> "(${event.type}) ${event.payload}" }

        TerminalUiState(
            input = input,
            activeRunId = activeRunId,
            history = history,
            outputLines = (runOutput + streamedEventLines).distinct()
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), TerminalUiState())

    fun onInputChanged(value: String) {
        inputText.value = value
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
