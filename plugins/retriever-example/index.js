/**
 * Example Retriever Plugin
 *
 * Demonstrates how to fetch data from external sources.
 * Note: This is a mock implementation for demonstration.
 */

// Simulated data store (in real use, this would fetch from APIs)
const MOCK_DATA = {
  weather: {
    "us-east": { temp: 72, condition: "sunny", humidity: 45 },
    "us-west": { temp: 65, condition: "cloudy", humidity: 60 },
    "eu-west": { temp: 58, condition: "rainy", humidity: 80 },
  },
  pricing: {
    "aws-ec2-t3-micro": 0.0104,
    "aws-ec2-t3-small": 0.0208,
    "aws-ec2-t3-medium": 0.0416,
  },
  "exchange-rates": {
    USD_EUR: 0.92,
    USD_GBP: 0.79,
    USD_JPY: 149.5,
  },
};

module.exports = {
  /**
   * Register retrievers with Reach
   * @returns {Object} Retrievers to register
   */
  register() {
    return {
      retrievers: {
        /**
         * Weather data retriever
         */
        weather: {
          description: "Current weather conditions by region",
          cacheable: true,
          cacheTtlSeconds: 300, // 5 minutes

          /**
           * Retrieve weather data
           * @param {Object} params - Retrieval parameters
           * @param {string} params.region - Region code
           * @returns {Promise<Object>} Weather data
           */
          async retrieve(params) {
            const { region } = params;

            if (!region) {
              throw new Error("Region parameter required");
            }

            // Simulate network delay
            await delay(100);

            const data = MOCK_DATA.weather[region];

            if (!data) {
              throw new Error(`Unknown region: ${region}`);
            }

            return {
              source: "retriever-example.weather",
              retrieved_at: new Date().toISOString(),
              data,
            };
          },

          /**
           * Validate parameters
           * @param {Object} params - Parameters to validate
           * @returns {Object} Validation result
           */
          validate(params) {
            const errors = [];

            if (!params.region) {
              errors.push("region is required");
            } else if (!/^[a-z-]+$/.test(params.region)) {
              errors.push("region must be lowercase letters and hyphens");
            }

            return {
              valid: errors.length === 0,
              errors,
            };
          },
        },

        /**
         * Cloud pricing retriever
         */
        pricing: {
          description: "Cloud resource pricing information",
          cacheable: true,
          cacheTtlSeconds: 3600, // 1 hour

          async retrieve(params) {
            const { service, region } = params;

            await delay(150);

            const key = `${service}-${region}`;
            const price = MOCK_DATA.pricing[key];

            if (!price) {
              return {
                source: "retriever-example.pricing",
                retrieved_at: new Date().toISOString(),
                data: null,
                note: `No pricing found for ${service} in ${region}`,
              };
            }

            return {
              source: "retriever-example.pricing",
              retrieved_at: new Date().toISOString(),
              data: {
                service,
                region,
                hourly_price: price,
                monthly_estimate: price * 24 * 30,
                currency: "USD",
              },
            };
          },

          validate(params) {
            const errors = [];

            if (!params.service) {
              errors.push("service is required");
            }
            if (!params.region) {
              errors.push("region is required");
            }

            return {
              valid: errors.length === 0,
              errors,
            };
          },
        },

        /**
         * Exchange rate retriever
         */
        "exchange-rate": {
          description: "Currency exchange rates",
          cacheable: true,
          cacheTtlSeconds: 600, // 10 minutes

          async retrieve(params) {
            const { from, to } = params;
            const pair = `${from}_${to}`.toUpperCase();

            await delay(50);

            const rate = MOCK_DATA["exchange-rates"][pair];

            if (!rate) {
              throw new Error(
                `Exchange rate not available for ${from} to ${to}`,
              );
            }

            return {
              source: "retriever-example.exchange-rate",
              retrieved_at: new Date().toISOString(),
              data: {
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                rate,
                inverse: 1 / rate,
              },
            };
          },

          validate(params) {
            const errors = [];
            const validCurrencies = ["USD", "EUR", "GBP", "JPY"];

            if (!params.from) {
              errors.push("from currency is required");
            } else if (!validCurrencies.includes(params.from.toUpperCase())) {
              errors.push(`from must be one of: ${validCurrencies.join(", ")}`);
            }

            if (!params.to) {
              errors.push("to currency is required");
            } else if (!validCurrencies.includes(params.to.toUpperCase())) {
              errors.push(`to must be one of: ${validCurrencies.join(", ")}`);
            }

            return {
              valid: errors.length === 0,
              errors,
            };
          },
        },
      },
    };
  },
};

/**
 * Simulate network delay
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
