# Reach Express Integration Integration kit for using Reach with Express.js.

## Setup ```bash
npm install @reach/sdk express
npm install -D @types/express
```

## Basic Example ```typescript
import express from 'express';
import { createReachClient } from '@reach/sdk';

const app = express();
app.use(express.json());

const reach = createReachClient({
  baseUrl: process.env.REACH_BASE_URL || 'http://127.0.0.1:8787'
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const health = await reach.health();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Reach server unavailable' });
  }
});

// Create a run
app.post('/api/runs', async (req, res) => {
  try {
    const run = await reach.createRun(req.body);
    res.status(201).json(run);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create run' });
  }
});

// Get run details
app.get('/api/runs/:id', async (req, res) => {
  try {
    const run = await reach.getRun(req.params.id);
    res.json(run);
  } catch (error) {
    res.status(404).json({ error: 'Run not found' });
  }
});

// Get run events
app.get('/api/runs/:id/events', async (req, res) => {
  try {
    const after = req.query.after ? parseInt(req.query.after as string) : undefined;
    const events = await reach.getRunEvents(req.params.id, after);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Create capsule
app.post('/api/capsules', async (req, res) => {
  try {
    const { runId } = req.body;
    const capsule = await reach.createCapsule(runId);
    res.status(201).json(capsule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create capsule' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

## Environment Variables ```env
REACH_BASE_URL=http://127.0.0.1:8787
PORT=3000
```

## License Apache 2.0
