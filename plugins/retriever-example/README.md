# Retriever Example Plugin

Demonstrates fetching external data within Reach executions.

## ⚠️ Important Note

This plugin requires `network: true` permission. Real implementations should:
- Handle network failures gracefully
- Respect rate limits
- Cache responses appropriately
- Validate all inputs

## Retrievers

### weather

Retrieve weather data by region:

```javascript
const result = await reach.retrieve("weather", {
  region: "us-east"
});

// Returns:
{
  source: "retriever-example.weather",
  retrieved_at: "2024-01-15T10:30:00Z",
  data: {
    temp: 72,
    condition: "sunny",
    humidity: 45
  }
}
```

### pricing

Get cloud resource pricing:

```javascript
const result = await reach.retrieve("pricing", {
  service: "aws-ec2-t3-micro",
  region: "us-east-1"
});

// Returns:
{
  source: "retriever-example.pricing",
  data: {
    service: "aws-ec2-t3-micro",
    region: "us-east-1",
    hourly_price: 0.0104,
    monthly_estimate: 7.488,
    currency: "USD"
  }
}
```

### exchange-rate

Currency conversion rates:

```javascript
const result = await reach.retrieve("exchange-rate", {
  from: "USD",
  to: "EUR"
});

// Returns:
{
  source: "retriever-example.exchange-rate",
  data: {
    from: "USD",
    to: "EUR",
    rate: 0.92,
    inverse: 1.0869565
  }
}
```

## Caching

All retrievers support caching:

```javascript
{
  cacheable: true,
  cacheTtlSeconds: 300 // 5 minutes
}
```

Reach automatically caches results to:
- Reduce API calls
- Improve performance
- Ensure deterministic replay

## Usage in Packs

```json
{
  "declared_permissions": ["retriever:weather", "retriever:pricing"],
  "execution_graph": {
    "steps": [
      {
        "id": "get-weather",
        "tool": "retrieve",
        "retriever": "weather",
        "params": { "region": "us-east" }
      }
    ]
  }
}
```

## Creating Real Retrievers

Replace `MOCK_DATA` with actual API calls:

```javascript
async retrieve(params) {
  const response = await fetch(
    `https://api.example.com/weather?region=${params.region}`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return {
    source: "my-retriever",
    retrieved_at: new Date().toISOString(),
    data: await response.json()
  };
}
```
