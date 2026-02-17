package com.reach.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.reach.mobile.ui.CompanionScreen
import com.reach.mobile.ui.CompanionViewModel
import com.reach.mobile.ui.TerminalScreen
import com.reach.mobile.ui.TerminalViewModel
import com.reach.mobile.ui.MarketplaceScreen
import com.reach.mobile.ui.MarketplaceViewModel
import com.reach.mobile.ui.theme.ReachTheme

private const val TERMINAL_ROUTE = "/"
private const val COMPANION_ROUTE = "/companion"
private const val MARKETPLACE_ROUTE = "/marketplace"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ReachTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    val initialRoute = when (intent?.data?.path) {
                        COMPANION_ROUTE -> COMPANION_ROUTE
                        else -> TERMINAL_ROUTE
                    }
                    NavHost(navController = navController, startDestination = initialRoute) {
                        composable(TERMINAL_ROUTE) {
                            val terminalViewModel: TerminalViewModel = viewModel()
                            TerminalScreen(
                                viewModel = terminalViewModel,
                                onMarketplaceClick = { navController.navigate(MARKETPLACE_ROUTE) }
                            )
                        }
                        composable(MARKETPLACE_ROUTE) {
                            val marketplaceViewModel: MarketplaceViewModel = viewModel()
                            MarketplaceScreen(viewModel = marketplaceViewModel)
                        }
                        composable(COMPANION_ROUTE) {
                            val companionViewModel: CompanionViewModel = viewModel()
                            val runId = intent?.data?.getQueryParameter("run_id")
                            LaunchedEffect(runId) {
                                if (!runId.isNullOrBlank()) {
                                    companionViewModel.connect(runId)
                                }
                            }
                            CompanionScreen(viewModel = companionViewModel)
                        }
                    }
                }
            }
        }
    }
}
