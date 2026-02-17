package com.reach.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Reach Terminal",
            style = MaterialTheme.typography.titleLarge,
            color = Color(0xFF90CAF9)
        )

        Text(
            text = "History",
            style = MaterialTheme.typography.titleMedium,
            color = Color.White
        )
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items(state.history) { command ->
                Text(
                    text = "> $command",
                    color = Color(0xFFB0BEC5),
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        Text(
            text = "Streaming Output",
            style = MaterialTheme.typography.titleMedium,
            color = Color.White
        )
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Color(0xFF11181C))
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            items(state.outputLines) { line ->
                Text(
                    text = line,
                    color = Color(0xFFB9F6CA),
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = state.input,
                onValueChange = viewModel::onInputChanged,
                label = { Text("Command") },
                modifier = Modifier.weight(1f)
            )
            Button(onClick = viewModel::submit) {
                Text("Run")
            }
        }
    }
}
