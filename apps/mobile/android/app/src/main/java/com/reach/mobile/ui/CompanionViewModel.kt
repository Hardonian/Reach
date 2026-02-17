package com.reach.mobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.reach.mobile.data.StreamEvent
import com.reach.mobile.network.MockRunnerGateway
import com.reach.mobile.network.RealRunnerGateway
import com.reach.mobile.network.RunnerConfig
import com.reach.mobile.network.RunnerGateway
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

data class PolicyGatePrompt(
    val gateId: String,
    val reason: String
)

data class PatchPrompt(
    val patchId: String,
    val title: String,
    val unifiedDiff: String
)

data class CompanionUiState(
    val runIdInput: String = "",
    val runId: String? = null,
    val status: String = "Idle",
    val events: List<StreamEvent> = emptyList(),
    val pendingPolicyGate: PolicyGatePrompt? = null,
    val pendingPatch: PatchPrompt? = null,
    val workspaceFiles: List<String> = emptyList(),
    val selectedFilePath: String? = null,
    val selectedFilePreview: String = "",
    val error: String? = null
)

class CompanionViewModel(application: Application) : AndroidViewModel(application) {
    private val gateway: RunnerGateway = if (RunnerConfig.mockMode) MockRunnerGateway() else RealRunnerGateway()
    private val _uiState = MutableStateFlow(CompanionUiState())
    val uiState: StateFlow<CompanionUiState> = _uiState.asStateFlow()

    private var streamJob: Job? = null
    private var lastEventId: String? = null

    fun onRunIdInputChanged(value: String) {
        _uiState.update { it.copy(runIdInput = value) }
    }

    fun connect(runId: String = _uiState.value.runIdInput.trim()) {
        if (runId.isBlank()) {
            _uiState.update { it.copy(error = "Run ID is required") }
            return
        }
        streamJob?.cancel()
        _uiState.update {
            it.copy(
                runId = runId,
                status = "Connecting",
                events = emptyList(),
                pendingPolicyGate = null,
                pendingPatch = null,
                workspaceFiles = emptyList(),
                selectedFilePath = null,
                selectedFilePreview = "",
                error = null
            )
        }

        streamJob = viewModelScope.launch {
            gateway.streamRun(
                runId = runId,
                initialLastEventId = lastEventId,
                onEvent = ::onEvent,
                onInfo = { info -> _uiState.update { state -> state.copy(status = info, error = null) } },
                onError = { throwable ->
                    _uiState.update { state -> state.copy(status = "Disconnected", error = throwable.message.orEmpty()) }
                },
                onComplete = { _uiState.update { state -> state.copy(status = "Stream completed") } },
                onLastEventId = { eventId -> lastEventId = eventId },
                isActive = { streamJob?.isActive == true }
            )
        }
    }

    private fun onEvent(event: StreamEvent) {
        _uiState.update { state ->
            val nextEvents = (state.events + event).takeLast(200)
            var nextState = state.copy(events = nextEvents, status = event.type, error = null)
            if (event.type == "policy.gate.requested") {
                nextState = nextState.copy(pendingPolicyGate = event.toPolicyGatePrompt())
            }
            val patchPrompt = event.toPatchPrompt()
            if (patchPrompt != null) {
                nextState = nextState.copy(pendingPatch = patchPrompt)
            }
            if (event.type == "run.completed") {
                val status = event.payloadAsObject()?.get("status")?.jsonPrimitive?.content ?: "completed"
                nextState = nextState.copy(status = "Run $status")
            }
            nextState
        }
    }

    fun submitPolicyDecision(decision: String) {
        val runId = _uiState.value.runId ?: return
        val prompt = _uiState.value.pendingPolicyGate ?: return
        viewModelScope.launch {
            gateway.submitPolicyDecision(runId, prompt.gateId, decision)
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            pendingPolicyGate = null,
                            status = "Policy decision sent: $decision",
                            error = null
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.update { it.copy(error = throwable.message.orEmpty()) }
                }
        }
    }

    fun submitPatchDecision(decision: String) {
        val runId = _uiState.value.runId ?: return
        val patch = _uiState.value.pendingPatch ?: return
        viewModelScope.launch {
            gateway.submitPatchDecision(runId, patch.patchId, decision)
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            pendingPatch = null,
                            status = "Patch decision sent: $decision",
                            error = null
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.update { it.copy(error = throwable.message.orEmpty()) }
                }
        }
    }

    fun refreshWorkspaceFiles() {
        val runId = _uiState.value.runId ?: return
        viewModelScope.launch {
            gateway.fetchWorkspaceFiles(runId)
                .onSuccess { files ->
                    _uiState.update { it.copy(workspaceFiles = files, error = null) }
                }
                .onFailure { throwable -> _uiState.update { it.copy(error = throwable.message.orEmpty()) } }
        }
    }

    fun previewFile(path: String) {
        val runId = _uiState.value.runId ?: return
        viewModelScope.launch {
            gateway.fetchWorkspaceFile(runId, path)
                .onSuccess { content ->
                    _uiState.update {
                        it.copy(
                            selectedFilePath = path,
                            selectedFilePreview = content,
                            error = null
                        )
                    }
                }
                .onFailure { throwable -> _uiState.update { it.copy(error = throwable.message.orEmpty()) } }
        }
    }

    override fun onCleared() {
        streamJob?.cancel()
        super.onCleared()
    }

    private fun StreamEvent.payloadAsObject(): JsonObject? = payload as? JsonObject

    private fun StreamEvent.toPolicyGatePrompt(): PolicyGatePrompt {
        val payload = payloadAsObject()
        val gateId = payload?.get("gateId")?.jsonPrimitive?.content ?: eventId
        val reason = payload?.get("reason")?.jsonPrimitive?.content ?: "Approval required"
        return PolicyGatePrompt(gateId = gateId, reason = reason)
    }

    private fun StreamEvent.toPatchPrompt(): PatchPrompt? {
        val payload = payloadAsObject() ?: return null
        val patchId = payload["patchId"]?.jsonPrimitive?.content ?: return null
        val diff = payload["diff"]?.jsonPrimitive?.content ?: return null
        val title = payload["title"]?.jsonPrimitive?.content ?: "Patch $patchId"
        return PatchPrompt(patchId = patchId, title = title, unifiedDiff = diff)
    }
}
