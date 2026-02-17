package com.reach.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reach.mobile.data.MarketplaceItem
import com.reach.mobile.data.InstallIntentResponse

@Composable
fun MarketplaceScreen(viewModel: MarketplaceViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.selectedItem != null) {
        MarketplaceItemDetail(
            item = state.selectedItem!!,
            onBack = { viewModel.clearSelection() },
            onInstall = { viewModel.requestInstall(it) }
        )
    } else {
        MarketplaceHome(
            state = state,
            onSearch = viewModel::onSearchQueryChanged,
            onItemClick = viewModel::selectItem
        )
    }

    if (state.showConsentSheet && state.installIntent != null) {
        MarketplaceConsentSheet(
            intent = state.installIntent!!,
            onDismiss = { viewModel.clearSelection() },
            onConfirm = { caps, risk -> viewModel.confirmInstall(caps, risk) },
            isInstalling = state.isInstalling
        )
    }
    
    if (state.error != null) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissError() },
            title = { Text("Error") },
            text = { Text(state.error!!) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissError() }) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
fun MarketplaceHome(
    state: MarketplaceUiState,
    onSearch: (String) -> Unit,
    onItemClick: (MarketplaceItem) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0F10))
            .padding(16.dp)
    ) {
        Text(
            text = "Marketplace",
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White,
            modifier = Modifier.padding(bottom = 16.dp)
        )
        
        OutlinedTextField(
            value = state.searchQuery,
            onValueChange = onSearch,
            label = { Text("Search connectors, templates...") },
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedBorderColor = Color(0xFF90CAF9),
                unfocusedBorderColor = Color.Gray
            )
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(state.items) { item ->
                MarketplaceItemCard(item = item, onClick = { onItemClick(item) })
            }
        }
    }
}

@Composable
fun MarketplaceItemCard(item: MarketplaceItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2329))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White
                )
                Badge(
                    containerColor = if (item.publisher.verified) Color(0xFF4CAF50) else Color.Gray,
                    contentColor = Color.White
                ) {
                    Text(if (item.publisher.verified) "Verified" else "Community")
                }
            }
            Text(
                text = item.description,
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFFB0BEC5),
                maxLines = 2
            )
            Row(modifier = Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                 SuggestionChip(
                    onClick = {},
                    label = { Text(item.kind) },
                    colors = SuggestionChipDefaults.suggestionChipColors(containerColor = Color(0xFF2C333A))
                )
                 SuggestionChip(
                    onClick = {},
                    label = { Text(item.tierRequired.uppercase()) },
                    colors = SuggestionChipDefaults.suggestionChipColors(containerColor = Color(0xFF2C333A))
                )
            }
        }
    }
}

@Composable
fun MarketplaceItemDetail(
    item: MarketplaceItem,
    onBack: () -> Unit,
    onInstall: (MarketplaceItem) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0F10))
            .padding(16.dp)
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
        }
        
        Text(
            text = item.name,
            style = MaterialTheme.typography.headlineLarge,
            color = Color.White
        )
        Text(
            text = "by ${item.publisher.name}",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF90CAF9)
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = item.description,
            style = MaterialTheme.typography.bodyLarge,
            color = Color(0xFFE0E0E0)
        )

        Spacer(modifier = Modifier.height(24.dp))
        
        Text("Capabilities", style = MaterialTheme.typography.titleMedium, color = Color.White)
        item.requiredCapabilities.forEach { cap ->
             Row(verticalAlignment = Alignment.CenterVertically) {
                 Icon(Icons.Default.Check, contentDescription = null, tint = Color.Green, modifier = Modifier.size(16.dp))
                 Text(text = cap, color = Color(0xFFB0BEC5), modifier = Modifier.padding(start = 8.dp))
             }
        }

        Spacer(modifier = Modifier.weight(1f))
        
        Button(
            onClick = { onInstall(item) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2962FF))
        ) {
            Text("Install")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MarketplaceConsentSheet(
    intent: InstallIntentResponse,
    onDismiss: () -> Unit,
    onConfirm: (List<String>, Boolean) -> Unit,
    isInstalling: Boolean
) {
    var acceptedRisk by remember { mutableStateOf(false) }
    
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
        ) {
            Text(
                text = "Review Request",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.Black
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            Text("This package requires the following capabilities:", fontWeight = FontWeight.Bold)
            intent.permissionsSummary.requiredCapabilities.forEach { cap ->
                Text("• $cap")
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Text("Risk Level: ${intent.permissionsSummary.riskLevel.uppercase()}", color = if (intent.permissionsSummary.riskLevel == "high") Color.Red else Color.Black)
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = acceptedRisk, onCheckedChange = { acceptedRisk = it })
                Text("I accept the risks and side effects associated with this package.")
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Button(
                onClick = { onConfirm(intent.permissionsSummary.requiredCapabilities, acceptedRisk) },
                enabled = acceptedRisk && !isInstalling,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isInstalling) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                } else {
                    Text("Confirm Install")
                }
            }
        }
    }
}
