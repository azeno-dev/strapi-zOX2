#!/bin/bash
# Auto-increment a semantic version held in a plain-text VERSION file.
#
# Usage: ./bump_version.sh <version_file_path>

set -euo pipefail

VERSION_FILE="${1:-}"

if [ -z "$VERSION_FILE" ]; then
    echo "Error: No version file provided." >&2
    exit 1
fi

if [ ! -f "$VERSION_FILE" ]; then
    echo "Error: Version file '$VERSION_FILE' not found." >&2
    exit 1
fi

CURRENT_VERSION=$(tr -d '[:space:]' < "$VERSION_FILE")

IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"

MAJOR=${VERSION_PARTS[0]:-0}
MINOR=${VERSION_PARTS[1]:-0}
PATCH=${VERSION_PARTS[2]:-0}

if [ "$MINOR" -ge 99 ]; then
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
    NEW_PATCH=0
elif [ "$PATCH" -ge 99 ]; then
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
else
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$MINOR
    NEW_PATCH=$((PATCH + 1))
fi

NEW_VERSION="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"

echo "$NEW_VERSION" > "$VERSION_FILE"
echo "$NEW_VERSION"
