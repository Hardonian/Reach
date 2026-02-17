package com.reach.mobile.network

import com.reach.mobile.BuildConfig

object RunnerConfig {
    val baseUrl: String = BuildConfig.RUNNER_BASE_URL.trimEnd('/')
    val runEndpoint: String = "$baseUrl/runs"
    val eventsEndpointForRun: (String) -> String = { runId -> "$baseUrl/runs/$runId/events" }
}
