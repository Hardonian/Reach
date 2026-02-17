package com.reach.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.reach.mobile.data.InstallIntentRequest
import com.reach.mobile.data.InstallIntentResponse
import com.reach.mobile.data.InstallRequest
import com.reach.mobile.data.MarketplaceItem
import com.reach.mobile.network.ConnectorRegistryClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MarketplaceUiState(
    val items: List<MarketplaceItem> = emptyList(),
    val searchQuery: String = "",
    val isLoading: Boolean = false,
    val selectedItem: MarketplaceItem? = null,
    val installIntent: InstallIntentResponse? = null,
    val isInstalling: Boolean = false,
    val error: String? = null,
    val showConsentSheet: Boolean = false
)

class MarketplaceViewModel(
    private val client: ConnectorRegistryClient = ConnectorRegistryClient()
) : ViewModel() {

    private val _uiState = MutableStateFlow(MarketplaceUiState())
    val uiState: StateFlow<MarketplaceUiState> = _uiState.asStateFlow()

    init {
        loadCatalog()
    }

    fun onSearchQueryChanged(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        loadCatalog(query)
    }

    fun loadCatalog(query: String = "") {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = client.listCatalog(query = query)
            result.onSuccess { page ->
                _uiState.update { it.copy(items = page.items, isLoading = false) }
            }.onFailure { e ->
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun selectItem(item: MarketplaceItem) {
        _uiState.update { it.copy(selectedItem = item) }
    }

    fun clearSelection() {
        _uiState.update { it.copy(selectedItem = null, installIntent = null, showConsentSheet = false) }
    }

    fun requestInstall(item: MarketplaceItem) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = client.createInstallIntent(InstallIntentRequest(kind = item.kind, id = item.id))
            result.onSuccess { intent ->
                _uiState.update { it.copy(installIntent = intent, showConsentSheet = true, isLoading = false) }
            }.onFailure { e ->
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    fun confirmInstall(acceptedCapabilities: List<String>, acceptedRisk: Boolean) {
        val intent = _uiState.value.installIntent ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isInstalling = true, error = null) }
            val req = InstallRequest(
                kind = intent.kind,
                id = intent.id,
                version = intent.resolvedVersion,
                idempotencyKey = intent.idempotencyKey,
                acceptedCapabilities = acceptedCapabilities,
                acceptedRisk = acceptedRisk
            )
            val result = client.install(req)
            result.onSuccess {
                _uiState.update { it.copy(isInstalling = false, showConsentSheet = false, installIntent = null, selectedItem = null) }
                loadCatalog(_uiState.value.searchQuery) // Refresh to show updated status if we had that info
            }.onFailure { e ->
                _uiState.update { it.copy(isInstalling = false, error = e.message) }
            }
        }
    }
    
    fun dismissError() {
        _uiState.update { it.copy(error = null) }
    }
}
