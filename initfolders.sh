#!/usr/bin/env bash
# inside project root folder
set -e

echo "Creating core insurance workspace structure..."

# Apps
mkdir -p apps/core-api
mkdir -p apps/channel-ui

# Packages
mkdir -p packages/domain
mkdir -p packages/contracts
mkdir -p packages/pricing-runner
mkdir -p packages/auth

# Infrastructure
mkdir -p infra

# Documentation
mkdir -p docs

# Root files
touch package.json
touch pnpm-workspace.yaml
touch README.md
touch docs/CORE_ARCHITECTURE.md

echo "Folder structure created successfully."

echo ""
echo "Structure:"
echo "  apps/core-api"
echo "  apps/channel-ui"
echo "  packages/domain"
echo "  packages/contracts"
echo "  packages/pricing-runner"
echo "  packages/auth"
echo "  infra"
echo "  docs"
echo "  package.json"
echo "  pnpm-workspace.yaml"
echo "  README.md"
echo "  docs/CORE_ARCHITECTURE.md"