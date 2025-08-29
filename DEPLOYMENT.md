# VERTEX CRM - VPS Deployment Guide

## 🚀 Quick Deployment (Hostinger VPS)

### Prerequisites
- Ubuntu 22.04 LTS VPS (✅ You have this)
- SSH access to your VPS
- Domain name (optional, can use IP address)

### Step 1: Connect to Your VPS

```bash
# SSH into your Hostinger VPS
ssh root@69.62.78.155

# Or if you have a different username:
ssh username@69.62.78.155
```

### Step 2: Initial Server Setup

```bash
# Run the server setup script
curl -fsSL https://raw.githubusercontent.com/your-username/vertex-crm/main/deploy/setup-server.sh | bash

# Or manually:
wget https://raw.githubusercontent.com/your-username/vertex-crm/main/deploy/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh
```

### Step 3: Clone and Deploy Application

```bash
# Navigate to web directory
cd /var/www

# Clone your repository
git clone https://github.com/your-username/vertex-crm.git vertex-crm
cd vertex-crm

# Make deployment script executable
chmod +x deploy/deploy.sh

# Run deployment
./deploy/deploy.sh
```

### Step 4: Configure Environment

```bash
# Copy environment template
cp env.production.example .env

# Edit environment variables
nano .env

# Update these important values:
# - JWT_SECRET (generate a secure random string)
# - ALLOWED_ORIGINS (add your domain/IP)
# - Change default passwords if any
```

### Step 5: Configure Nginx

```bash
# Copy Nginx configuration
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vertex-crm

# Update domain name in the config
sudo nano /etc/nginx/sites-available/vertex-crm
# Replace 'your-domain.com' with your actual domain or IP

# Enable the site
sudo ln -s /etc/nginx/sites-available/vertex-crm /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 6: Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown
```

### Step 7: Configure SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## 🔧 Management Commands

### Application Management
```bash
# Check application status
pm2 status

# View logs
pm2 logs vertex-crm

# Restart application
pm2 restart vertex-crm

# Stop application
pm2 stop vertex-crm

# Update application
cd /var/www/vertex-crm
./deploy/deploy.sh
```

### System Management
```bash
# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Check system resources
htop
df -h
free -h
```

### Database Management
```bash
# Backup database
cp /var/www/vertex-crm/vertex_crm.db /var/backups/vertex_crm_$(date +%Y%m%d_%H%M%S).db

# View database
cd /var/www/vertex-crm
sqlite3 vertex_crm.db
.tables
.quit
```

## 🌐 Access Your Application

After deployment, access your VERTEX CRM at:
- **HTTP**: `http://your-ip-address` or `http://your-domain.com`
- **HTTPS**: `https://your-domain.com` (after SSL setup)

Default login:
- **Username**: `admin`
- **Password**: `vertex2024`

## 🔒 Security Checklist

- [ ] Change default admin password
- [ ] Update JWT_SECRET in .env
- [ ] Configure firewall (UFW enabled)
- [ ] Setup SSL certificate
- [ ] Regular backups configured
- [ ] Monitor logs regularly

## 🐛 Troubleshooting

### Application won't start
```bash
# Check PM2 logs
pm2 logs vertex-crm

# Check if port is in use
sudo netstat -tlnp | grep :3000

# Restart application
pm2 restart vertex-crm
```

### Nginx issues
```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Database issues
```bash
# Check database file permissions
ls -la /var/www/vertex-crm/vertex_crm.db

# Fix permissions if needed
chown www-data:www-data /var/www/vertex-crm/vertex_crm.db
```

## 📊 Monitoring

### System Monitoring
```bash
# Install htop for system monitoring
sudo apt install htop

# Check system resources
htop
df -h
free -h
```

### Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# View real-time logs
pm2 logs vertex-crm --lines 100
```

## 🔄 Updates

To update your application:

```bash
cd /var/www/vertex-crm
git pull origin main
./deploy/deploy.sh
```

## 📞 Support

If you encounter issues:
1. Check the logs: `pm2 logs vertex-crm`
2. Verify Nginx: `sudo nginx -t`
3. Check system resources: `htop`
4. Review this guide for troubleshooting steps

---

**Your VERTEX CRM should now be running on your Hostinger VPS!** 🎉
