package com.reach.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val ReachDarkColors = darkColorScheme()

@Composable
fun ReachTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ReachDarkColors,
        typography = androidx.compose.material3.Typography(),
        content = content
    )
}
