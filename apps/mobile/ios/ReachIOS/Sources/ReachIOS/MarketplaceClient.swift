import Foundation

public enum MarketplaceError: Error {
    case invalidURL
    case networkError(Error)
    case apiError(Int, String)
    case decodingError(Error)
}

public class MarketplaceClient {
    private let baseURL: String
    private let session: URLSession

    public init(baseURL: String = "http://localhost:8092/v1", session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func listCatalog(query: String = "", kind: String = "", page: Int = 1, pageSize: Int = 20) async throws -> CatalogPage {
        var components = URLComponents(string: "\(baseURL)/marketplace/catalog")
        components?.queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize))
        ]
        if !query.isEmpty {
            components?.queryItems?.append(URLQueryItem(name: "q", value: query))
        }
        if !kind.isEmpty {
            components?.queryItems?.append(URLQueryItem(name: "kind", value: kind))
        }

        guard let url = components?.url else {
            throw MarketplaceError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        try validateResponse(response, data: data)
        return try JSONDecoder().decode(CatalogPage.self, from: data)
    }

    public func getItem(kind: String, id: String) async throws -> MarketplaceItem {
        guard let url = URL(string: "\(baseURL)/marketplace/items/\(kind)/\(id)") else {
            throw MarketplaceError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        try validateResponse(response, data: data)
        return try JSONDecoder().decode(MarketplaceItem.self, from: data)
    }

    public func createInstallIntent(req: InstallIntentRequest) async throws -> InstallIntentResponse {
        guard let url = URL(string: "\(baseURL)/marketplace/install-intent") else {
            throw MarketplaceError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(req)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)
        return try JSONDecoder().decode(InstallIntentResponse.self, from: data)
    }

    public func install(req: InstallRequest) async throws -> InstalledConnector {
        guard let url = URL(string: "\(baseURL)/marketplace/install") else {
            throw MarketplaceError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(req)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)
        return try JSONDecoder().decode(InstalledConnector.self, from: data)
    }

    public func update(req: InstallRequest) async throws -> InstalledConnector {
        guard let url = URL(string: "\(baseURL)/marketplace/update") else {
            throw MarketplaceError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(req)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)
        return try JSONDecoder().decode(InstalledConnector.self, from: data)
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw MarketplaceError.networkError(NSError(domain: "Invalid response", code: 0))
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw MarketplaceError.apiError(httpResponse.statusCode, message)
        }
    }
}
