#!/bin/sh
# Strip weight from node_modules after `strapi build` has produced build/.
#
#   sh scripts/prune-node-modules.sh [safe|extra]

set -eu

LEVEL="${1:-safe}"
cd "$(dirname "$0")/.."

[ -d node_modules ] || { echo "prune: no node_modules, nothing to do"; exit 0; }

case "$LEVEL" in
    safe|extra) ;;
    *) echo "prune: unknown level '$LEVEL' (expected safe|extra)" >&2; exit 1 ;;
esac

BEFORE="$(du -sm node_modules | cut -f1)"

# ── Never loaded by the running server ───────────────────────────────────────
find node_modules -name '*.d.ts' -type f -delete 2>/dev/null || true
find node_modules -name '*.js.map' -type f -delete 2>/dev/null || true
find node_modules -name '*.css.map' -type f -delete 2>/dev/null || true
find node_modules -iname '*.md' -type f -delete 2>/dev/null || true
find node_modules -type d \( -name test -o -name tests -o -name __tests__ \
     -o -name docs -o -name example -o -name examples \) \
     -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf node_modules/@types 2>/dev/null || true

if [ "$LEVEL" = "extra" ]; then
    for pkg in node-plop @formatjs core-js-pure @reduxjs better-sqlite3; do
        rm -rf "node_modules/$pkg" 2>/dev/null || true
    done
fi

AFTER="$(du -sm node_modules | cut -f1)"
echo "prune-node-modules ($LEVEL): ${BEFORE}MB -> ${AFTER}MB"
