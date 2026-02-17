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
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
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
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
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
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Editor Companion", color = Color(0xFF90CAF9), style = MaterialTheme.typography.titleLarge)

        OutlinedTextField(
            value = state.runIdInput,
            onValueChange = viewModel::onRunIdInputChanged,
            label = { Text("Run ID") },
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { viewModel.connect() }) { Text("Connect") }
            Button(onClick = viewModel::refreshWorkspaceFiles, enabled = state.runId != null) { Text("Load Workspace") }
        }

        Text("run_id: ${state.runId ?: "-"}", color = Color.White, fontFamily = FontFamily.Monospace)
        Text("status: ${state.status}", color = Color(0xFFFFF59D), fontFamily = FontFamily.Monospace)
        state.error?.let { Text("error: $it", color = Color(0xFFFF8A80), fontFamily = FontFamily.Monospace) }

        Text("Last 50 Events", color = Color.White)
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
                    .padding(8.dp)
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
                    .padding(8.dp)
            ) {
                items(state.selectedFilePreview.lines()) { line ->
                    Text(line, color = Color(0xFFE0F7FA), fontFamily = FontFamily.Monospace)
                }
            }
        }
    }
}
