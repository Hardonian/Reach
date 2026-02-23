/**
 * Reach Express Integration Example
 *
 * This example shows how to integrate Reach with an Express application.
 *
 * Prerequisites:
 * 1. Reach server running on http://127.0.0.1:8787
 *    Start with: reach serve
 * 2. Dependencies installed
 *    Run: npm install
 *
 * Usage:
 *   npm run dev
 *
 * Then visit:
 *   http://localhost:3000/health
 *   http://localhost:3000/api/runs (POST)
 *   http://localhost:3000/api/runs/:id (GET)
 */

import express from "express";
import { createReachClient } from "@reach/sdk";

const app = express();
app.use(express.json());

const reach = createReachClient({
  baseUrl: process.env.REACH_BASE_URL || "http://127.0.0.1:8787",
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const health = await reach.health();
    res.json({
      status: "ok",
      reach: health,
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Reach server unavailable",
    });
  }
});

// Create a new run
app.post("/api/runs", async (req, res) => {
  try {
    const { capabilities, plan_tier } = req.body;
    const run = await reach.createRun({ capabilities, plan_tier });
    res.status(201).json(run);
  } catch (error) {
    console.error("Error creating run:", error);
    res.status(500).json({ error: "Failed to create run" });
  }
});

// Get run details
app.get("/api/runs/:id", async (req, res) => {
  try {
    const run = await reach.getRun(req.params.id);
    res.json(run);
  } catch (error) {
    res.status(404).json({ error: "Run not found" });
  }
});

// Get run events
app.get("/api/runs/:id/events", async (req, res) => {
  try {
    const after = req.query.after
      ? parseInt(req.query.after as string)
      : undefined;
    const events = await reach.getRunEvents(req.params.id, after);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to get events" });
  }
});

// Create capsule from run
app.post("/api/capsules", async (req, res) => {
  try {
    const { run_id } = req.body;
    const capsule = await reach.createCapsule(run_id);
    res.status(201).json(capsule);
  } catch (error) {
    res.status(500).json({ error: "Failed to create capsule" });
  }
});

// Search packs
app.get("/api/packs", async (req, res) => {
  try {
    const query = req.query.q as string | undefined;
    const packs = await reach.searchPacks(query);
    res.json(packs);
  } catch (error) {
    res.status(500).json({ error: "Failed to search packs" });
  }
});

// Federation status
app.get("/api/federation/status", async (req, res) => {
  try {
    const status = await reach.getFederationStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get federation status" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
  console.log("");
  console.log("Endpoints:");
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  POST http://localhost:${PORT}/api/runs`);
  console.log(`  GET  http://localhost:${PORT}/api/runs/:id`);
  console.log(`  GET  http://localhost:${PORT}/api/runs/:id/events`);
  console.log(`  POST http://localhost:${PORT}/api/capsules`);
  console.log(`  GET  http://localhost:${PORT}/api/packs`);
  console.log(`  GET  http://localhost:${PORT}/api/federation/status`);
});
