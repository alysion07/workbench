#!/bin/bash

set -e

# Build the Docker image
docker buildx build ./ --file ./Dockerfile --tag etri-vsmr/vsmr-sim-web:latest

# Get current repository SHA
REPO_SHA=$(git rev-parse --short=7 HEAD)
echo "✓ Repository SHA: $REPO_SHA"

# Get current date in yyyy.mm.dd format
DATE_TAG=$(date +%Y.%m.%d)
echo "✓ Date tag: $DATE_TAG"

# Create version tag
VERSION_TAG="$DATE_TAG-$REPO_SHA"
echo "✓ Version tag: $VERSION_TAG"

# Tag the image with version
echo "Tagging image with version tag..."
docker tag "etri-vsmr/vsmr-sim-web:latest" "etri-vsmr/vsmr-sim-web:$VERSION_TAG"
echo "✓ Image tagged successfully: etri-vsmr/vsmr-sim-web:$VERSION_TAG"
