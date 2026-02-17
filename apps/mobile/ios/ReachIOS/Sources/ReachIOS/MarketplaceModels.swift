import Foundation

public struct MarketplaceItem: Identifiable, Codable {
    public let kind: String
    public let id: String
    public let name: String
    public let description: String
    public let publisher: Publisher
    public let latestVersion: String
    public let riskLevel: String
    public let tierRequired: String
    public let requiredCapabilities: [String]
    public let sideEffectTypes: [String]

    enum CodingKeys: String, CodingKey {
        case kind, id, name, description, publisher
        case latestVersion = "latest_version"
        case riskLevel = "risk_level"
        case tierRequired = "tier_required"
        case requiredCapabilities = "required_capabilities"
        case sideEffectTypes = "side_effect_types"
    }
}

public struct Publisher: Codable {
    public let name: String
    public let verified: Bool
}

public struct CatalogPage: Codable {
    public let items: [MarketplaceItem]
    public let page: Int
    public let pageSize: Int
    public let total: Int

    enum CodingKeys: String, CodingKey {
        case items, page
        case pageSize = "page_size"
        case total
    }
}

public struct InstallIntentRequest: Codable {
    public let kind: String
    public let id: String
}

public struct InstallIntentResponse: Codable {
    public let kind: String
    public let id: String
    public let resolvedVersion: String
    public let idempotencyKey: String
    public let permissionsSummary: PermissionsSummary
    public let signature: SignatureSummary
    public let publisher: Publisher
    public let tier: TierSummary

    enum CodingKeys: String, CodingKey {
        case kind, id, signature, publisher, tier
        case resolvedVersion = "resolved_version"
        case idempotencyKey = "idempotency_key"
        case permissionsSummary = "permissions_summary"
    }
}

public struct PermissionsSummary: Codable {
    public let requiredCapabilities: [String]
    public let sideEffectTypes: [String]
    public let riskLevel: String

    enum CodingKeys: String, CodingKey {
        case requiredCapabilities = "required_capabilities"
        case sideEffectTypes = "side_effect_types"
        case riskLevel = "risk_level"
    }
}

public struct SignatureSummary: Codable {
    public let method: String
    public let keyId: String
    public let verified: Bool

    enum CodingKeys: String, CodingKey {
        case method
        case keyId = "key_id"
        case verified
    }
}

public struct TierSummary: Codable {
    public let required: String
    public let allowed: Bool
    public let current: String
}

public struct InstallRequest: Codable {
    public let kind: String
    public let id: String
    public let version: String
    public let idempotencyKey: String
    public let acceptedCapabilities: [String]
    public let acceptedRisk: Bool

    enum CodingKeys: String, CodingKey {
        case kind, id, version
        case idempotencyKey = "idempotency_key"
        case acceptedCapabilities = "accepted_capabilities"
        case acceptedRisk = "accepted_risk"
    }
}

public struct InstalledConnector: Codable {
    public let id: String
    public let pinnedVersion: String
    public let installedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case pinnedVersion = "pinned_version"
        case installedAt = "installed_at"
    }
}
