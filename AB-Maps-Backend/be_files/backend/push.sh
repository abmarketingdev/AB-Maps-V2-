#!/bin/bash

# Quick push script for AB Maps Backend
echo "🚀 Pushing AB Maps Backend to GitHub..."

# Check status
echo "📋 Checking git status..."
git status

# Add all changes
echo "📦 Adding changes..."
git add .

# Commit (you can modify the message)
echo "💾 Committing changes..."
git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

echo "✅ Push completed successfully!"
echo "🌐 Repository: https://github.com/texhy/Backend-For-AB-Maps-Final-Version" 