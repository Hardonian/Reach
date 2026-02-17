package com.reach.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.reach.mobile.ui.TerminalScreen
import com.reach.mobile.ui.TerminalViewModel
import com.reach.mobile.ui.theme.ReachTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ReachTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val terminalViewModel: TerminalViewModel = viewModel()
                    TerminalScreen(viewModel = terminalViewModel)
                }
            }
        }
    }
}
