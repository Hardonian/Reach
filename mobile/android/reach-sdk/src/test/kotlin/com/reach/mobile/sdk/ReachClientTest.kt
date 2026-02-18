package com.reach.mobile.sdk

import kotlin.test.Test
import kotlin.test.assertTrue

class ReachClientTest {
    @Test
    fun smokeInstantiation() {
        val client = ReachClient("http://localhost:8080")
        assertTrue(client.toString().isNotEmpty())
    }
}
