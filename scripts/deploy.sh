#!/bin/bash
# deploy.sh — Run this on the VPS after git pull
set -e

echo "🔄 Installing dependencies..."
npm install --production=false

echo "🏗️  Building..."
npm run build

echo "♻️  Restarting pm2..."
pm2 restart clipperfox

echo "📡 Submitting URLs to Google Indexing API..."
node scripts/submit-indexing.mjs || echo "⚠️  Indexing submission failed (check service-account.json setup)"

echo "✅ Deploy complete!"
