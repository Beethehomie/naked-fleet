#!/bin/bash
# ============================================================
# Naked Fleet — one-command deploy
# Usage:  ./deploy.sh "what you changed"
# Example: ./deploy.sh "added inspections page"
# ============================================================

set -e

MSG=${1:-"update"}

echo ""
echo "🚀  Naked Fleet deploy"
echo "──────────────────────"

git add -A
git commit -m "$MSG"
git push origin main

echo ""
echo "✅  Pushed. Railway is deploying now."
echo "    Watch: https://railway.app/dashboard"
echo ""
