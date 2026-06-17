#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ] && [ -f "node_modules/prisma/build/index.js" ]; then
  echo "Running Prisma migrations..."
  node node_modules/prisma/build/index.js migrate deploy
elif [ -n "$DATABASE_URL" ]; then
  echo "Prisma CLI is not bundled; skipping migrations."
else
  echo "DATABASE_URL is not set; skipping Prisma migrations."
fi

exec "$@"
