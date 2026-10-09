# Reach VS Code Extension ## Install and build

```bash
cd extensions/vscode
npm install
npm run build
```

## Launch in VS Code 1. Open `extensions/vscode` in VS Code.

2. Run **Run Extension** from the debug panel (or press `F5`).
3. In the Extension Development Host, open the command palette and run:
   - `Reach: Start Bridge Connection`
   - `Reach: Open Bridge Panel`
   - `Reach: Send Selection to Bridge`

## Context payload shape ```json

{
"workspace_root": "/workspace/Reach",
"open_files": [
"/workspace/Reach/extensions/vscode/src/extension.ts"
],
"active_file": "/workspace/Reach/extensions/vscode/src/extension.ts",
"selection_range": {
"start": { "line": 12, "character": 2 },
"end": { "line": 16, "character": 18 }
}
}

```

```
