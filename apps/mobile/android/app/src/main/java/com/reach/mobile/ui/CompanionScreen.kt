package com.reach.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanionScreen(viewModel: CompanionViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.pendingPolicyGate != null) {
        ModalBottomSheet(onDismissRequest = {}) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Policy Gate Requested", style = MaterialTheme.typography.titleLarge)
                Text(state.pendingPolicyGate.reason)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { viewModel.submitPolicyDecision("approve_once") }) { Text("Approve Once") }
                    Button(onClick = { viewModel.submitPolicyDecision("approve_for_run") }) { Text("Approve For Run") }
                }
                Button(onClick = { viewModel.submitPolicyDecision("deny") }) { Text("Deny") }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0F10))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("Editor Companion", color = Color(0xFF90CAF9), style = MaterialTheme.typography.titleLarge)

        OutlinedTextField(
            value = state.runIdInput,
            onValueChange = viewModel::onRunIdInputChanged,
            label = { Text("Run ID") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = state.sessionIdInput,
            onValueChange = viewModel::onSessionIdInputChanged,
            label = { Text("Session ID") },
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { viewModel.joinSession() }) { Text("Join Session") }
        }

        Text("session: ${state.sessionId ?: "-"}", color = Color.White, fontFamily = FontFamily.Monospace)
        Text("members: ${state.sessionMembers.joinToString(", ").ifBlank { "-" }}", color = Color(0xFFE1F5FE), fontFamily = FontFamily.Monospace)
        Text("node: ${state.assignedNode ?: "-"}", color = Color(0xFFB9F6CA), fontFamily = FontFamily.Monospace)
        Text("sync: ${state.syncStatus}", color = Color(0xFFA5D6A7), fontFamily = FontFamily.Monospace)
        Text("repo sync mode: ${state.repoSyncMode}", color = Color(0xFF80CBC4), fontFamily = FontFamily.Monospace)
        Text("devices: ${state.deviceList.joinToString(", ")}", color = Color(0xFFCE93D8), fontFamily = FontFamily.Monospace)
        Text("tier: ${state.tierBadge}", color = Color(0xFFFFCC80), fontFamily = FontFamily.Monospace)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { viewModel.connect() }) { Text("Connect") }
            Button(onClick = viewModel::refreshWorkspaceFiles, enabled = state.runId != null) { Text("Load Workspace") }
            Button(onClick = viewModel::stopAutonomous, enabled = state.runId != null) { Text("Stop") }
        }

        Text("run_id: ${state.runId ?: "-"}", color = Color.White, fontFamily = FontFamily.Monospace)
        Text("status: ${state.status}", color = Color(0xFFFFF59D), fontFamily = FontFamily.Monospace)
        Text("autonomous iterations: ${state.autonomousIterations}", color = Color.White, fontFamily = FontFamily.Monospace)
        LinearProgressIndicator(progress = if (state.maxIterations == 0) 0f else state.autonomousIterations.toFloat() / state.maxIterations.toFloat(), modifier = Modifier.fillMaxWidth())
        LinearProgressIndicator(progress = if (state.maxToolCalls == 0) 0f else state.toolCallCount.toFloat() / state.maxToolCalls.toFloat(), modifier = Modifier.fillMaxWidth())
        state.error?.let { Text("error: $it", color = Color(0xFFFF8A80), fontFamily = FontFamily.Monospace) }

        Text("Recent Events", color = Color.White)
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Color(0xFF11181C))
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items(state.events) { event ->
                Text(
                    text = "${event.eventId} [${event.type}] ${event.raw}",
                    color = Color(0xFFB9F6CA),
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        state.pendingPatch?.let { patch ->
            Text("Diff Viewer", color = Color.White)
            Text(patch.title, color = Color(0xFFE1F5FE))
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 180.dp)
                    .background(Color(0xFF11181C))
                    .padding(6.dp)
            ) {
                items(patch.unifiedDiff.lines()) { line ->
                    val color = when {
                        line.startsWith("+") -> Color(0xFFB9F6CA)
                        line.startsWith("-") -> Color(0xFFFFCDD2)
                        else -> Color(0xFFCFD8DC)
                    }
                    Text(line, color = color, fontFamily = FontFamily.Monospace)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { viewModel.submitPatchDecision("approve") }) { Text("Approve Patch") }
                Button(onClick = { viewModel.submitPatchDecision("deny") }) { Text("Deny Patch") }
            }
        }


        Text("Connectors", color = Color.White)
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 160.dp)
                .background(Color(0xFF11181C))
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items(state.connectors) { connector ->
                val riskColor = when (connector.risk) {
                    "strict" -> Color(0xFFFF8A80)
                    "experimental" -> Color(0xFFFFF59D)
                    else -> Color(0xFFB9F6CA)
                }
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${connector.id} (${connector.provider})", color = Color.White)
                        Switch(checked = connector.enabled, onCheckedChange = { viewModel.toggleConnector(connector.id, it) })
                    }
                    Text("Scopes: ${connector.scopes.joinToString()}", color = Color(0xFF80DEEA), fontFamily = FontFamily.Monospace)
                    Text("Risk: ${connector.risk}", color = riskColor, fontFamily = FontFamily.Monospace)
                }
            }
        }

        Text("Workspace Files", color = Color.White)
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 120.dp)
                .background(Color(0xFF11181C))
                .padding(8.dp)
        ) {
            items(state.workspaceFiles) { filePath ->
                Text(
                    text = filePath,
                    color = Color(0xFF80DEEA),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.previewFile(filePath) }
                        .padding(4.dp),
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        if (state.selectedFilePath != null) {
            Text("Preview: ${state.selectedFilePath}", color = Color.White)
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 160.dp)
                    .background(Color(0xFF11181C))
                    .padding(6.dp)
            ) {
                items(state.selectedFilePreview.lines()) { line ->
                    Text(line, color = Color(0xFFE0F7FA), fontFamily = FontFamily.Monospace)
                }
            }
        }
    }
}
