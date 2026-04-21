#!/bin/bash

set -e

LOCAL_IMAGE="etri-vsmr/vsmr-sim-web:latest"
GHCR_REPO="ghcr.io/etri-vsmr/vsmr-sim-web"
ENV_FILE="GitHub-Personal-Access-Token.env"

# Check if the local image exists
echo "Checking if local image '$LOCAL_IMAGE' exists..."
LOCAL_IMAGE_EXISTS=$(docker images --format "{{.Repository}}:{{.Tag}}" "$LOCAL_IMAGE")
if [ -z "$LOCAL_IMAGE_EXISTS" ]; then
  echo "Error: Local image '$LOCAL_IMAGE' not found."
  echo "Please build the image first using 3-build-vsmr-sim-web-container-image.sh"
  exit 1
fi
echo "✓ Local image '$LOCAL_IMAGE' found."

# Read PAT from environment file
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: '$ENV_FILE' file not found."
  echo "Please create the file from the template and add your GitHub Personal Access Token:"
  echo "  cp GitHub-Personal-Access-Token.env.template GitHub-Personal-Access-Token.env"
  echo "  # Then edit the file and set PAT_WRITE_PACKAGES=<your-token>"
  exit 1
fi

# SECURITY WARNING: Do not source user-provided files directly to avoid arbitrary code execution.
# Safely extract PAT_WRITE_PACKAGES from the environment file
raw_pat_line=$(grep -E '^PAT_WRITE_PACKAGES=' "$ENV_FILE" | tail -n 1 || true)
PAT_WRITE_PACKAGES=${raw_pat_line#PAT_WRITE_PACKAGES=}
# Trim leading/trailing whitespace
PAT_WRITE_PACKAGES=$(printf '%s' "$PAT_WRITE_PACKAGES" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
# Remove surrounding matching quotes, if present
if [ "${PAT_WRITE_PACKAGES#\"}" != "$PAT_WRITE_PACKAGES" ] && [ "${PAT_WRITE_PACKAGES%\"}" != "$PAT_WRITE_PACKAGES" ]; then
  PAT_WRITE_PACKAGES=${PAT_WRITE_PACKAGES#\"}
  PAT_WRITE_PACKAGES=${PAT_WRITE_PACKAGES%\"}
elif [ "${PAT_WRITE_PACKAGES#\'}" != "$PAT_WRITE_PACKAGES" ] && [ "${PAT_WRITE_PACKAGES%\'}" != "$PAT_WRITE_PACKAGES" ]; then
  PAT_WRITE_PACKAGES=${PAT_WRITE_PACKAGES#\'}
  PAT_WRITE_PACKAGES=${PAT_WRITE_PACKAGES%\'}
fi
# Basic validation: allow only letters, digits, and underscores in the token
case "$PAT_WRITE_PACKAGES" in
  (*[!A-Za-z0-9_]*)
    echo "Error: PAT_WRITE_PACKAGES contains unexpected characters. Please check '$ENV_FILE'."
    exit 1
    ;;
esac

if [ -z "$PAT_WRITE_PACKAGES" ]; then
  echo "Error: PAT_WRITE_PACKAGES environment variable not set in '$ENV_FILE'."
  echo ""
  echo "Please follow these steps:"
  echo "1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)"
  echo "2. Click 'Generate new token (classic)'"
  echo "3. Select the 'write:packages' permission"
  echo "4. Generate the token and copy it"
  echo "5. Edit '$ENV_FILE' and set: PAT_WRITE_PACKAGES=<your-token>"
  exit 1
fi

# Login to GHCR
echo "Logging in to GitHub Container Registry..."
if ! echo "$PAT_WRITE_PACKAGES" | docker login ghcr.io -u etri-vsmr --password-stdin; then
  echo ""
  echo "Error: Failed to login to GHCR."
  echo ""
  echo "Please check your Personal Access Token and follow these steps if needed:"
  echo "1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)"
  echo "2. Click 'Generate new token (classic)'"
  echo "3. Select the 'write:packages' permission"
  echo "4. Generate the token and copy it"
  echo "5. Edit '$ENV_FILE' and set: PAT_WRITE_PACKAGES=<your-token>"
  unset PAT_WRITE_PACKAGES
  exit 1
fi
echo "✓ Successfully logged in to GHCR."
unset PAT_WRITE_PACKAGES

# Find the version tag that matches the date-SHA pattern AND points to the same image ID as :latest
LATEST_ID=$(docker images --format "{{.ID}}" etri-vsmr/vsmr-sim-web:latest)
if [ -z "$LATEST_ID" ]; then
  echo "Error: Could not determine image ID for etri-vsmr/vsmr-sim-web:latest."
  exit 1
fi

VERSION_TAG=$(docker images --format '{{.Tag}} {{.ID}}' etri-vsmr/vsmr-sim-web \
  | awk -v id="$LATEST_ID" '$1 ~ /^[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[a-fA-F0-9]{7}$/ && $2 == id { print $1; exit }')

if [ -z "$VERSION_TAG" ]; then
  echo "Error: No version tag found for etri-vsmr/vsmr-sim-web that matches the pattern and shares the same image ID as :latest."
  echo "Please run 3-build-vsmr-sim-web-container-image.sh first to create the versioned image."
  exit 1
fi
echo "✓ Found version tag: $VERSION_TAG"

# Tag the image for GHCR
echo "Tagging images for GHCR..."
docker tag "$LOCAL_IMAGE" "$GHCR_REPO:latest"
docker tag "etri-vsmr/vsmr-sim-web:$VERSION_TAG" "$GHCR_REPO:$VERSION_TAG"
echo "✓ Images tagged successfully."

# Push images to GHCR
echo "Pushing images to GHCR..."
docker push "$GHCR_REPO:latest"
docker push "$GHCR_REPO:$VERSION_TAG"
echo "✓ Images pushed successfully."

echo ""
echo "Successfully pushed images:"
echo "  - $GHCR_REPO:latest"
echo "  - $GHCR_REPO:$VERSION_TAG"
