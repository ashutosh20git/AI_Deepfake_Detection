#!/bin/sh
set -e

echo "Deploying database migrations..."
npx prisma migrate deploy

echo "Starting server..."
node src/server.js
