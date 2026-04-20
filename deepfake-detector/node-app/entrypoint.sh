#!/bin/sh
set -e

mkdir -p /app/uploads/gradcams

echo "Deploying database migrations..."
npx prisma migrate deploy

echo "Starting server..."
node src/server.js
