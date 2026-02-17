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

enum class NotificationLevel { passive, review_required, approval_required, guardrail_warning, stopped }

data class SessionNode(
    val id: String,
    val parentId: String? = null,
    val iterationCount: Int = 0,
    val budgetUsage: Float = 0f,
    val status: String = "idle",
    val expanded: Boolean = true
)

data class PolicyGatePrompt(val gateId: String, val reason: String)
data class PatchPrompt(val patchId: String, val title: String, val unifiedDiff: String)



data class ConnectorItem(
    val id: String,
    val provider: String,
    val scopes: List<String>,
    val risk: String,
    val enabled: Boolean
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
    val connectors: List<ConnectorItem> = listOf(
        ConnectorItem("github-core", "github", listOf("workspace:read", "repo:read"), "moderate", true),
        ConnectorItem("filesystem-admin", "filesystem", listOf("workspace:write"), "strict", false),
        ConnectorItem("jira-experimental", "jira", listOf("tickets:read", "tickets:write"), "experimental", false)
    ),
    val autonomousIterations: Int = 0,
    val maxIterations: Int = 0,
    val maxToolCalls: Int = 0,
    val toolCallCount: Int = 0,
    val maxRuntimeSeconds: Int = 0,
    val elapsedRuntimeSeconds: Int = 0,
    val maxSpawnDepth: Int = 0,
    val currentSpawnDepth: Int = 0,
    val sessionIdInput: String = "",
    val sessionId: String? = null,
    val sessionMembers: List<String> = emptyList(),
    val assignedNode: String? = null,
    val syncStatus: String = "Idle",
    val repoSyncMode: String = "metadata",
    val deviceList: List<String> = listOf("android-local"),
    val tierBadge: String = "FREE",
    val spawnNodes: List<SessionNode> = emptyList(),
    val notifications: List<String> = emptyList(),
    val error: String? = null
)

class CompanionViewModel(application: Application) : AndroidViewModel(application) {
    private val gateway: RunnerGateway = if (RunnerConfig.mockMode) MockRunnerGateway() else RealRunnerGateway()
    private val _uiState = MutableStateFlow(CompanionUiState())
    val uiState: StateFlow<CompanionUiState> = _uiState.asStateFlow()

    private var streamJob: Job? = null
    private var lastEventId: String? = null
    private val lastNotificationByType = linkedMapOf<String, String>()

    fun onRunIdInputChanged(value: String) { _uiState.update { it.copy(runIdInput = value) } }
    fun onSessionIdInputChanged(value: String) { _uiState.update { it.copy(sessionIdInput = value) } }

    fun toggleNode(id: String) {
        _uiState.update { state ->
            state.copy(spawnNodes = state.spawnNodes.map { if (it.id == id) it.copy(expanded = !it.expanded) else it })
        }
    }

    fun joinSession(sessionId: String = _uiState.value.sessionIdInput.trim(), member: String = "mobile-user") {
        if (sessionId.isBlank()) {
            _uiState.update { it.copy(error = "Session ID is required") }
            return
        }
        _uiState.update { state ->
            val members = (state.sessionMembers + member).distinct()
            state.copy(sessionId = sessionId, sessionMembers = members, status = "Session joined", error = null)
        }
    }

    fun connect(runId: String = _uiState.value.runIdInput.trim()) {
        if (runId.isBlank()) {
            _uiState.update { it.copy(error = "Run ID is required") }
            return
        }
        streamJob?.cancel()
        _uiState.update {
            it.copy(runId = runId, status = "Connecting", events = emptyList(), error = null)
        }
        streamJob = viewModelScope.launch {
            gateway.streamRun(runId, lastEventId, ::onEvent,
                onInfo = { info -> _uiState.update { s -> s.copy(status = info, error = null) } },
                onError = { t -> _uiState.update { s -> s.copy(status = "Disconnected", error = t.message.orEmpty()) } },
                onComplete = { _uiState.update { s -> s.copy(status = "Stream completed") } },
                onLastEventId = { eventId -> lastEventId = eventId },
                isActive = { streamJob?.isActive == true })
        }
    }

    private fun onEvent(event: StreamEvent) {
        _uiState.update { state ->
            val nextEvents = (state.events + event).takeLast(200)
            var nextState = state.copy(events = nextEvents, status = event.type, error = null)
            if (event.type == "capsule.sync.status") {
                val payload = event.payloadAsObject()
                val status = payload?.get("status")?.jsonPrimitive?.content ?: "Unknown"
                val mode = payload?.get("repo_sync_mode")?.jsonPrimitive?.content ?: nextState.repoSyncMode
                val tier = payload?.get("tier")?.jsonPrimitive?.content?.uppercase() ?: nextState.tierBadge
                nextState = nextState.copy(syncStatus = status, repoSyncMode = mode, tierBadge = tier)
            }
            if (event.type == "device.registered") {
                val device = event.payloadAsObject()?.get("device_id")?.jsonPrimitive?.content
                if (device != null) {
                    nextState = nextState.copy(deviceList = (nextState.deviceList + device).distinct())
                }
            }
            if (event.type == "policy.gate.requested") {
                nextState = nextState.copy(pendingPolicyGate = event.toPolicyGatePrompt())
            }
            val patchPrompt = event.toPatchPrompt()
            if (patchPrompt != null) {
                nextState = nextState.copy(pendingPatch = patchPrompt)
            }
            val payload = event.payloadAsObject()
            if (event.type == "policy.gate.requested") nextState = nextState.copy(pendingPolicyGate = event.toPolicyGatePrompt())
            event.toPatchPrompt()?.let { nextState = nextState.copy(pendingPatch = it) }
            if (event.type == "autonomous.checkpoint") {
                val iteration = payload?.get("iteration")?.jsonPrimitive?.content?.toIntOrNull() ?: nextState.autonomousIterations
                val toolCalls = payload?.get("tool_call_count")?.jsonPrimitive?.content?.toIntOrNull() ?: nextState.toolCallCount
                nextState = nextState.copy(autonomousIterations = iteration, toolCallCount = toolCalls)
            }
            if (event.type == "autonomous.paused") nextState = nextState.copy(status = "Autonomous paused")
            if (event.type == "autonomous.resumed") nextState = nextState.copy(status = "Autonomous resumed")
            if (event.type == "autonomous.stopped") nextState = nextState.copy(status = "Autonomous stopped")
            if (event.type == "run.node.selected") {
                val node = payload?.get("node_id")?.jsonPrimitive?.content
                if (node != null) {
                    nextState = nextState.copy(
                        assignedNode = node,
                        spawnNodes = upsertNode(nextState.spawnNodes, SessionNode(id = node, status = "active", iterationCount = nextState.autonomousIterations, budgetUsage = budgetUsage(nextState)))
                    )
                }
            }
            if (event.type == "session.run") {
                val node = payload?.get("node_id")?.jsonPrimitive?.content
                val runId = payload?.get("run_id")?.jsonPrimitive?.content ?: event.runId
                if (node != null) {
                    nextState = nextState.copy(spawnNodes = upsertNode(nextState.spawnNodes, SessionNode(id = node, parentId = runId, status = "running", iterationCount = nextState.autonomousIterations, budgetUsage = budgetUsage(nextState))))
                }
            }
            eventToNotification(event.type)?.let { level ->
                val message = "$level: ${event.type}"
                val previous = lastNotificationByType[event.type]
                if (previous != message) {
                    lastNotificationByType[event.type] = message
                    nextState = nextState.copy(notifications = (nextState.notifications + message).takeLast(20))
                }
            }
            nextState.copy(
                currentSpawnDepth = nextState.spawnNodes.maxOfOrNull { depthOf(nextState.spawnNodes, it) } ?: 0,
                maxSpawnDepth = maxOf(nextState.maxSpawnDepth, nextState.currentSpawnDepth)
            )
        }
    }

    private fun eventToNotification(type: String): NotificationLevel? = when (type) {
        "autonomous.stopped" -> NotificationLevel.stopped
        "policy.gate.requested" -> NotificationLevel.approval_required
        "autonomous.paused" -> NotificationLevel.guardrail_warning
        "patch.review.required" -> NotificationLevel.review_required
        "autonomous.checkpoint" -> NotificationLevel.passive
        else -> null
    }

    private fun budgetUsage(state: CompanionUiState): Float {
        val iter = if (state.maxIterations == 0) 0f else state.autonomousIterations.toFloat() / state.maxIterations.toFloat()
        val tools = if (state.maxToolCalls == 0) 0f else state.toolCallCount.toFloat() / state.maxToolCalls.toFloat()
        return maxOf(iter, tools)
    }

    private fun upsertNode(nodes: List<SessionNode>, node: SessionNode): List<SessionNode> {
        val existing = nodes.indexOfFirst { it.id == node.id }
        return if (existing < 0) nodes + node else nodes.toMutableList().also { it[existing] = node }
    }

    private fun depthOf(nodes: List<SessionNode>, node: SessionNode): Int {
        var depth = 0
        var current = node
        while (current.parentId != null) {
            val parent = nodes.firstOrNull { it.id == current.parentId } ?: break
            depth += 1
            current = parent
        }
        return depth
    }

    fun submitPolicyDecision(decision: String) { val runId = _uiState.value.runId ?: return; val prompt = _uiState.value.pendingPolicyGate ?: return; viewModelScope.launch { gateway.submitPolicyDecision(runId, prompt.gateId, decision).onSuccess { _uiState.update { it.copy(pendingPolicyGate = null, status = "Policy decision sent: $decision", error = null) } }.onFailure { t -> _uiState.update { it.copy(error = t.message.orEmpty()) } } } }
    fun submitPatchDecision(decision: String) { val runId = _uiState.value.runId ?: return; val patch = _uiState.value.pendingPatch ?: return; viewModelScope.launch { gateway.submitPatchDecision(runId, patch.patchId, decision).onSuccess { _uiState.update { it.copy(pendingPatch = null, status = "Patch decision sent: $decision", error = null) } }.onFailure { t -> _uiState.update { it.copy(error = t.message.orEmpty()) } } } }
    fun stopAutonomous() { val runId = _uiState.value.runId ?: return; viewModelScope.launch { gateway.stopAutonomous(runId).onSuccess { _uiState.update { it.copy(status = "Stopping autonomous loop", error = null) } }.onFailure { t -> _uiState.update { it.copy(error = t.message.orEmpty()) } } } }
    fun refreshWorkspaceFiles() { val runId = _uiState.value.runId ?: return; viewModelScope.launch { gateway.fetchWorkspaceFiles(runId).onSuccess { files -> _uiState.update { it.copy(workspaceFiles = files, error = null) } }.onFailure { t -> _uiState.update { it.copy(error = t.message.orEmpty()) } } } }
    fun previewFile(path: String) { val runId = _uiState.value.runId ?: return; viewModelScope.launch { gateway.fetchWorkspaceFile(runId, path).onSuccess { content -> _uiState.update { it.copy(selectedFilePath = path, selectedFilePreview = content, error = null) } }.onFailure { t -> _uiState.update { it.copy(error = t.message.orEmpty()) } } } }
    fun toggleConnector(id: String, enabled: Boolean) {
        _uiState.update { state ->
            state.copy(connectors = state.connectors.map { if (it.id == id) it.copy(enabled = enabled) else it })
        }
    }

    override fun onCleared() {
        streamJob?.cancel()
        super.onCleared()
    }

    override fun onCleared() { streamJob?.cancel(); super.onCleared() }
    private fun StreamEvent.payloadAsObject(): JsonObject? = payload as? JsonObject
    private fun StreamEvent.toPolicyGatePrompt(): PolicyGatePrompt { val payload = payloadAsObject(); return PolicyGatePrompt(payload?.get("gateId")?.jsonPrimitive?.content ?: eventId, payload?.get("reason")?.jsonPrimitive?.content ?: "Approval required") }
    private fun StreamEvent.toPatchPrompt(): PatchPrompt? { val payload = payloadAsObject() ?: return null; val patchId = payload["patchId"]?.jsonPrimitive?.content ?: return null; val diff = payload["diff"]?.jsonPrimitive?.content ?: return null; val title = payload["title"]?.jsonPrimitive?.content ?: "Patch $patchId"; return PatchPrompt(patchId, title, diff) }
}
