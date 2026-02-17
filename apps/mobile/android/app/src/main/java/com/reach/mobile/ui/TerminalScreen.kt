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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun TerminalScreen(viewModel: TerminalViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0F10))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "Reach Terminal",
            style = MaterialTheme.typography.titleLarge,
            color = Color(0xFF90CAF9)
        )

        state.streamInfo?.let {
            Text(text = it, color = Color(0xFFFFF59D), style = MaterialTheme.typography.bodySmall)
        }

        Text(text = "Command History", color = Color.White)
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.8f)
                .background(Color(0xFF11181C))
                .padding(6.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            items(items = state.history, key = { it }) { command ->
                Text(text = "> $command", color = Color(0xFFB0BEC5), fontFamily = FontFamily.Monospace)
            }
        }

        Text(text = "Output Stream", color = Color.White)
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1.2f)
                .background(Color(0xFF11181C))
                .padding(6.dp),
            verticalArrangement = Arrangement.spacedBy(1.dp)
        ) {
            items(items = state.outputLines, key = { it.hashCode() }) { line ->
                Text(text = line, color = Color(0xFFB9F6CA), fontFamily = FontFamily.Monospace)
            }
        }

        Text(text = "Artifacts", color = Color.White)
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.8f)
                .background(Color(0xFF11181C))
                .padding(6.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            items(items = state.artifacts, key = { it.id }) { artifact ->
                Text(
                    text = "${artifact.path} (${artifact.mimeType ?: "unknown"})",
                    color = Color(0xFF80DEEA),
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        OutlinedTextField(
            value = state.input,
            onValueChange = viewModel::onInputChanged,
            label = { Text("Command") },
            modifier = Modifier.fillMaxWidth()
        )

        if (state.completionSuggestions.isNotEmpty()) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 120.dp)
                    .background(Color(0xFF1A2126))
                    .padding(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(items = state.completionSuggestions, key = { it }) { suggestion ->
                    Text(
                        text = suggestion,
                        color = Color(0xFFE1F5FE),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.applySuggestion(suggestion) }
                            .padding(4.dp),
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(onClick = viewModel::submit) {
                Text("Run")
            }
        }
    }
}
