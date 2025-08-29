#!/bin/bash

# VERTEX CRM - VPS Server Setup Script
# For Ubuntu 22.04 LTS

set -e

echo "🚀 Setting up VERTEX CRM on VPS..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
sudo apt install -y nginx

# Install Git (if not already installed)
echo "📦 Installing Git..."
sudo apt install -y git

# Install SQLite3
echo "📦 Installing SQLite3..."
sudo apt install -y sqlite3

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/vertex-crm
sudo chown -R $USER:$USER /var/www/vertex-crm

# Create logs directory
sudo mkdir -p /var/log/vertex-crm
sudo chown -R $USER:$USER /var/log/vertex-crm

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Server setup completed!"
echo ""
echo "Next steps:"
echo "1. Clone your repository to /var/www/vertex-crm"
echo "2. Run the deployment script"
echo "3. Configure Nginx"
echo ""
