package com.reach.mobile.network

import com.reach.mobile.data.CatalogPage
import com.reach.mobile.data.InstallIntentRequest
import com.reach.mobile.data.InstallIntentResponse
import com.reach.mobile.data.InstallRequest
import com.reach.mobile.data.InstalledConnector
import com.reach.mobile.data.MarketplaceItem
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class ConnectorRegistryClient(
    private val httpClient: OkHttpClient = OkHttpClient(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {

    fun listCatalog(
        query: String = "",
        kind: String = "",
        page: Int = 1,
        pageSize: Int = 20
    ): Result<CatalogPage> {
        return runCatching {
            val url = "${RegistryConfig.BASE_URL}/marketplace/catalog".toHttpUrl()
                .newBuilder()
                .apply {
                    if (query.isNotEmpty()) addQueryParameter("q", query)
                    if (kind.isNotEmpty()) addQueryParameter("kind", kind)
                    addQueryParameter("page", page.toString())
                    addQueryParameter("page_size", pageSize.toString())
                }
                .build()

            val request = Request.Builder().url(url).get().build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Catalog fetch failed ${response.code}: $body")
                }
                json.decodeFromString<CatalogPage>(body)
            }
        }
    }

    fun getItem(kind: String, id: String): Result<MarketplaceItem> {
        return runCatching {
            val url = "${RegistryConfig.BASE_URL}/marketplace/items/$kind/$id".toHttpUrl()
            val request = Request.Builder().url(url).get().build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Item fetch failed ${response.code}: $body")
                }
                json.decodeFromString<MarketplaceItem>(body)
            }
        }
    }

    fun createInstallIntent(req: InstallIntentRequest): Result<InstallIntentResponse> {
        return runCatching {
            val payload = json.encodeToString(InstallIntentRequest.serializer(), req)
            val request = Request.Builder()
                .url("${RegistryConfig.BASE_URL}/marketplace/install-intent")
                .post(payload.toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Install intent failed ${response.code}: $body")
                }
                json.decodeFromString<InstallIntentResponse>(body)
            }
        }
    }

    fun install(req: InstallRequest): Result<InstalledConnector> {
        return runCatching {
            val payload = json.encodeToString(InstallRequest.serializer(), req)
            val request = Request.Builder()
                .url("${RegistryConfig.BASE_URL}/marketplace/install")
                .post(payload.toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Install failed ${response.code}: $body")
                }
                json.decodeFromString<InstalledConnector>(body)
            }
        }
    }

    fun update(req: InstallRequest): Result<InstalledConnector> {
        return runCatching {
            val payload = json.encodeToString(InstallRequest.serializer(), req)
            val request = Request.Builder()
                .url("${RegistryConfig.BASE_URL}/marketplace/update")
                .post(payload.toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    error("Update failed ${response.code}: $body")
                }
                json.decodeFromString<InstalledConnector>(body)
            }
        }
    }
}
