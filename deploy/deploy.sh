#!/bin/bash

# VERTEX CRM - Deployment Script
# Run this script to deploy/update the application

set -e

APP_DIR="/var/www/vertex-crm"
APP_NAME="vertex-crm"

echo "🚀 Deploying VERTEX CRM..."

# Navigate to app directory
cd $APP_DIR

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build the application
echo "🔨 Building application..."
npm run build

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your production settings"
fi

# Set proper permissions
echo "🔐 Setting permissions..."
chmod +x server.js
chown -R $USER:$USER $APP_DIR

# Restart PM2 process
echo "🔄 Restarting application..."
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# Show status
echo "📊 Application status:"
pm2 status

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your application should be running on:"
echo "   - Local: http://localhost:3000"
echo "   - Public: http://$(curl -s ifconfig.me):3000"
echo ""
echo "📝 To check logs: pm2 logs $APP_NAME"
echo "📊 To check status: pm2 status"
echo ""
