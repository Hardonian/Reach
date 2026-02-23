const plugin = require("./index");

describe("retriever-example plugin", () => {
  test("exports register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  test("register returns retrievers", () => {
    const result = plugin.register();
    expect(result).toHaveProperty("retrievers");
  });

  describe("weather retriever", () => {
    test("retrieves weather for valid region", async () => {
      const result = plugin.register();
      const retriever = result.retrievers["weather"];

      const data = await retriever.retrieve({ region: "us-east" });
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("temp");
      expect(data.data).toHaveProperty("condition");
    });

    test("throws for invalid region", async () => {
      const result = plugin.register();
      const retriever = result.retrievers["weather"];

      await expect(retriever.retrieve({ region: "invalid-region" })).rejects.toThrow(
        "Unknown region",
      );
    });

    test("validates parameters", () => {
      const result = plugin.register();
      const retriever = result.retrievers["weather"];

      const validation = retriever.validate({});
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("region is required");
    });
  });

  describe("pricing retriever", () => {
    test("retrieves pricing for valid service", async () => {
      const result = plugin.register();
      const retriever = result.retrievers["pricing"];

      const data = await retriever.retrieve({
        service: "aws-ec2-t3-micro",
        region: "us-east-1",
      });

      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("hourly_price");
    });

    test("returns null for unknown service", async () => {
      const result = plugin.register();
      const retriever = result.retrievers["pricing"];

      const data = await retriever.retrieve({
        service: "unknown",
        region: "us-east-1",
      });

      expect(data.data).toBeNull();
    });
  });

  describe("exchange-rate retriever", () => {
    test("retrieves rate for valid currencies", async () => {
      const result = plugin.register();
      const retriever = result.retrievers["exchange-rate"];

      const data = await retriever.retrieve({ from: "USD", to: "EUR" });
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("rate");
      expect(data.data).toHaveProperty("inverse");
    });

    test("throws for invalid currency", async () => {
      const result = plugin.register();
      const retriever = result.retrievers["exchange-rate"];

      await expect(retriever.retrieve({ from: "XYZ", to: "USD" })).rejects.toThrow();
    });
  });
});
