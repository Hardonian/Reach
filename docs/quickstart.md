# Quickstart

This is the fastest OSS path to a working Reach run lifecycle.

## 1) Install dependencies

```bash
npm install
```

## 2) Verify OSS boundaries and checks

```bash
npm run verify:oss
```

## 3) Start the evidence viewer

```bash
cd apps/arcade
npm install
npm run dev
```

Open: `http://localhost:3000/demo/evidence-viewer`

## 4) Verify routes do not hard-500

From repo root:

```bash
npm run verify:routes
```

## 5) Optional full local validation

```bash
npm run verify:fast
npm run test
cargo test -p engine-core
go test ./...
```
