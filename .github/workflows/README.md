# GitHub Actions Workflows

This directory contains the GitHub Actions workflows for the Coffee Dial project.

## deploy.yml

This workflow handles deployment to GitHub Pages. It runs on:
- Push to the main branch
- Manual workflow dispatch

The workflow:
1. Checks out the repository
2. Sets up GitHub Pages configuration
3. Uploads all files as a Pages artifact
4. Deploys to GitHub Pages

This replaces the dynamic Pages workflow that was causing runner acquisition errors.

## stage4-guardrails.yml

This workflow enforces Stage 4 module boundaries on push/PR to `main`.

It runs:
1. `node scripts/check-feature-boundaries.mjs`
2. `node scripts/check-command-ownership.mjs`
3. `node scripts/check-command-dispatch-coverage.mjs`
