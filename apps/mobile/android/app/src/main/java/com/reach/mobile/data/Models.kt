package com.reach.mobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class RunRequest(
    @SerialName("command") val command: String
)

@Serializable
data class RunResponse(
    @SerialName("run_id") val runId: String,
    @SerialName("accepted") val accepted: Boolean
)

data class Run(
    val id: String,
    val command: String,
    val status: RunStatus,
    val output: List<String>
)

enum class RunStatus {
    RUNNING,
    COMPLETED,
    FAILED
}

data class RunEvent(
    val runId: String,
    val type: String,
    val payload: String
)
