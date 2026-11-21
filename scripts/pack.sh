#!/bin/sh
set -eu

scripts=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
[ -f dist/index.html ] || { echo 'Missing dist/index.html; run the build first' >&2; exit 1; }
node "$scripts/check-version.mjs"

if [ "$(uname -s)" = Darwin ]; then
  export COPYFILE_DISABLE=1
fi

# Do not replace release assets with a partial archive or checksum on failure.
staging=$(mktemp -d './.theme-pack.XXXXXX')
trap 'rm -rf -- "$staging"' EXIT
trap 'exit 1' HUP INT TERM
archive="$staging/theme.tar.gz"
tar czf "$archive" --no-xattrs --no-acls --exclude='._*' --exclude='*/._*' dist theme.json preview.png
gzip -t "$archive"
node "$scripts/verify-package.mjs" --limits-only "$archive"
node -e 'const {createHash} = require("node:crypto"); const {readFileSync} = require("node:fs"); console.log(createHash("sha256").update(readFileSync(process.argv[1])).digest("hex"))' "$archive" > "$archive.sha256"
mv -f -- "$archive" theme.tar.gz
mv -f -- "$archive.sha256" theme.tar.gz.sha256
printf 'Packed theme.tar.gz (sha256: %s)\n' "$(cat theme.tar.gz.sha256)"
