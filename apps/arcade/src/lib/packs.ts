export interface Pack {
  id: string;
  name: string;
  objective: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  duration: string;
  tools: string[];
  arcadeSafe: boolean;
  inputs?: Record<string, string>;
  policyConstraints?: string[];
  author: {
    name: string;
    verified: boolean;
  };
  verifiedSignature?: boolean;
}

export const CATALOG: Pack[] = [
  {
    id: "hello-world-v1",
    name: "Hello Reach",
    objective: "Say hello to the world",
    description: "A simple pack that logs a greeting. Perfect for beginners.",
    difficulty: "easy",
    duration: "< 2s",
    tools: ["console.log"],
    arcadeSafe: true,
    inputs: {
      name: "Agent",
    },
    policyConstraints: ["no-network", "no-fs-write"],
    author: {
      name: "Reach Team",
      verified: true,
    },
    verifiedSignature: true,
  },
  {
    id: "weather-fetch-v1",
    name: "Weather Check",
    objective: "Get current weather",
    description: "Fetches weather for a location using a public API.",
    difficulty: "easy",
    duration: "~500ms",
    tools: ["http.get"],
    arcadeSafe: true,
    inputs: {
      city: "San Francisco",
    },
    policyConstraints: ["allow-domain: api.weather.gov"],
    author: {
      name: "WeatherAPI",
      verified: true,
    },
    verifiedSignature: true,
  },
  {
    id: "math-solver-v1",
    name: "Math Solver",
    objective: "Solve a math problem",
    description: "Uses basic arithmetic capabilities to solve an equation.",
    difficulty: "medium",
    duration: "~100ms",
    tools: ["math.eval"],
    arcadeSafe: true,
    inputs: {
      expression: "2 + 2 * 4",
    },
    policyConstraints: ["pure-logic"],
    author: {
      name: "Community",
      verified: false,
    },
    verifiedSignature: false,
  },
  {
    id: "unsafe-pack-v1",
    name: "System Access",
    objective: "Read system files",
    description: "This pack attempts to read sensitive files.",
    difficulty: "hard",
    duration: "unknown",
    tools: ["fs.read"],
    arcadeSafe: false,
    policyConstraints: ["fs-read-all"],
    author: {
      name: "Unknown",
      verified: false,
    },
    verifiedSignature: false,
  },
];

export const PACK_MAP = new Map(CATALOG.map((p) => [p.id, p]));
