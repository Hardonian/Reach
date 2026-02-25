#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const economicsDir = path.resolve(__dirname);
const packageJsonPath = path.join(economicsDir, "package.json");
const nodeModulesPath = path.join(economicsDir, "node_modules");

// Check if npm dependencies need to be installed
function needsNpmInstall() {
  if (!fs.existsSync(nodeModulesPath)) {
    return true;
  }

  try {
    const packageJsonStats = fs.statSync(packageJsonPath);
    const nodeModulesStats = fs.statSync(nodeModulesPath);
    return packageJsonStats.mtime > nodeModulesStats.mtime;
  } catch (error) {
    return true;
  }
}

// Run npm install if needed
if (needsNpmInstall()) {
  console.log("Installing npm dependencies for economics tool...");
  execSync("npm install --silent", {
    cwd: economicsDir,
    stdio: "inherit"
  });
}

// Run the actual TypeScript command
const args = process.argv.slice(2);
const command = `npm start --silent -- ${args.join(" ")}`;
execSync(command, {
  cwd: economicsDir,
  stdio: "inherit"
});
