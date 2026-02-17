package com.reach.mobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MarketplaceItem(
    val kind: String,
    val id: String,
    val name: String,
    val description: String,
    val publisher: Publisher,
    val versions: List<MarketplaceVersion>,
    @SerialName("latest_version") val latestVersion: String,
    @SerialName("risk_level") val riskLevel: String,
    @SerialName("tier_required") val tierRequired: String,
    @SerialName("required_capabilities") val requiredCapabilities: List<String> = emptyList(),
    @SerialName("side_effect_types") val sideEffectTypes: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val categories: List<String> = emptyList(),
    @SerialName("docs_url") val docsUrl: String? = null,
    @SerialName("repo_url") val repoUrl: String? = null,
    val changelog: String? = null
)

@Serializable
data class Publisher(
    val name: String,
    @SerialName("key_id") val keyId: String,
    val verified: Boolean
)

@Serializable
data class MarketplaceVersion(
    val version: String,
    @SerialName("published_at") val publishedAt: String,
    @SerialName("sha256") val sha256: String,
    val signed: Boolean,
    @SerialName("signature_key_id") val signatureKeyId: String
)

@Serializable
data class CatalogPage(
    val items: List<MarketplaceItem>,
    val total: Int,
    val page: Int,
    @SerialName("page_size") val pageSize: Int
)

@Serializable
data class InstallIntentRequest(
    val kind: String,
    val id: String,
    val version: String? = null
)

@Serializable
data class InstallIntentResponse(
    val kind: String,
    val id: String,
    @SerialName("resolved_version") val resolvedVersion: String,
    @SerialName("idempotency_key") val idempotencyKey: String,
    @SerialName("permissions_summary") val permissionsSummary: PermissionsSummary,
    val signature: SignatureSummary,
    val publisher: Publisher,
    val tier: TierSummary
)

@Serializable
data class PermissionsSummary(
    @SerialName("required_capabilities") val requiredCapabilities: List<String>,
    @SerialName("side_effect_types") val sideEffectTypes: List<String>,
    @SerialName("risk_level") val riskLevel: String
)

@Serializable
data class SignatureSummary(
    val signed: Boolean,
    val verified: Boolean,
    @SerialName("signature_key_id") val signatureKeyId: String? = null,
    val status: String
)

@Serializable
data class TierSummary(
    val required: String,
    val allowed: Boolean,
    val current: String
)

@Serializable
data class InstallRequest(
    val kind: String,
    val id: String,
    val version: String,
    @SerialName("idempotency_key") val idempotencyKey: String,
    @SerialName("accepted_capabilities") val acceptedCapabilities: List<String>,
    @SerialName("accepted_risk") val acceptedRisk: Boolean
)

@Serializable
data class InstalledConnector(
    val kind: String,
    val id: String,
    @SerialName("pinned_version") val pinnedVersion: String,
    @SerialName("verified_by") val verifiedBy: String,
    val hash: String
)
