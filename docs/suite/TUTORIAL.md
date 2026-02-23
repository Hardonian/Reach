# Tutorial Mode — Reach OSS Suite

Last Updated: 2026-02-22

## Overview

The Tutorial Mode provides an interactive "Learn by Doing" experience for new users. It teaches core Reach concepts through guided missions that can be completed in about 5 minutes.

## Features

- **Local-only**: No network required, works entirely offline
- **Progress Saving**: Your progress is saved in the workspace
- **XP System**: Earn points as you complete missions
- **Guided Missions**: Step-by-step instructions with hints

## Commands

```bash
reachctl tutorial start       # Begin the tutorial
reachctl tutorial next       # Move to next mission
reachctl tutorial status     # View progress
reachctl tutorial explain <mission>  # Get detailed help
```

## Mission Structure

Each mission includes:

- Name and description
- Step-by-step instructions
- Hints (optional)
- XP reward

## User-Facing Terminology

- **Mission**: A single tutorial task
- **Progress**: Your completion state
- **XP**: Experience points earned

## Missions

1. **Welcome to Reach** - Learn the basics (10 XP)
2. **Your First Run** - Execute your first run (20 XP)
3. **Replay a Run** - Verify execution integrity (25 XP)
4. **Compare Runs** - Find differences between runs (30 XP)
5. **Create a Checkpoint** - Save workspace state (25 XP)
6. **Simulate New Rules** - Test policy changes (35 XP)
7. **Chaos Testing** - Test workspace resilience (40 XP)
8. **Improve Your Trust Score** - Workspace health (50 XP)

## Progress Tracking

Progress is stored in `data/tutorial_progress.json` and includes:

- Current mission
- Completed missions
- Total XP earned

## Notes

- Tutorial is completely free and works offline
- No API keys required
- Progress persists across sessions
