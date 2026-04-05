#!/bin/bash
set -euo pipefail

# =============================================================================
# Hostinger VPS Deployment Script for assessment.upchange.ai
# Run this on a fresh Ubuntu 22.04/24.04 VPS
# Usage: bash deploy.sh
# =============================================================================

DOMAIN="assessment.upchange.ai"
EMAIL="${CERTBOT_EMAIL:-admin@upchange.ai}"
APP_DIR="/opt/linkedinagent"
REPO_URL="https://github.com/YOUR_USERNAME/LinkedInAgentUI.git"  # <-- UPDATE THIS
BRANCH="release"

echo "============================================"
echo "  Deploying $DOMAIN"
echo "============================================"

# --- 1. System Updates ---
echo "[1/7] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw

# --- 2. Install Docker ---
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo "Docker installed. You may need to log out and back in for group changes."
else
    echo "Docker already installed."
fi

# Ensure Docker Compose plugin is available
if ! docker compose version &> /dev/null; then
    sudo apt-get install -y docker-compose-plugin
fi

# --- 3. Firewall ---
echo "[3/7] Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# --- 4. Clone / Pull Repository ---
echo "[4/7] Setting up application..."
if [ -d "$APP_DIR" ]; then
    echo "App directory exists, pulling latest..."
    cd "$APP_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    echo "Cloning repository..."
    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER:$USER" "$APP_DIR"
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# --- 5. Environment Config ---
echo "[5/7] Checking config..."
if [ ! -f "./Backend/config.env" ]; then
    echo ""
    echo "============================================"
    echo "  IMPORTANT: config.env not found!"
    echo "  Copy your config.env to $APP_DIR/Backend/config.env"
    echo "  Make sure to set:"
    echo "    FRONTEND_ORIGIN=https://$DOMAIN"
    echo "    OPENAI_API_KEY=your-key"
    echo "    APIFY_API_TOKEN=your-token"
    echo "    MCP_API_KEY=a-strong-random-key"
    echo "============================================"
    echo ""
    echo "After creating config.env, run this script again."
    exit 1
fi

# Ensure FRONTEND_ORIGIN is set
if ! grep -q "FRONTEND_ORIGIN=https://$DOMAIN" ./Backend/config.env; then
    echo "Setting FRONTEND_ORIGIN in config.env..."
    sed -i "s|^FRONTEND_ORIGIN=.*|FRONTEND_ORIGIN=https://$DOMAIN|" ./Backend/config.env
fi

# --- 6. SSL Certificate ---
echo "[6/7] Setting up SSL certificate..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Obtaining initial SSL certificate..."

    # Stop anything on port 80
    sudo systemctl stop nginx 2>/dev/null || true
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true

    # Get certificate using standalone mode
    sudo docker run --rm \
        -p 80:80 \
        -v "$(docker volume create certbot-conf):/etc/letsencrypt" \
        -v "$(docker volume create certbot-www):/var/www/certbot" \
        certbot/certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"

    echo "SSL certificate obtained!"
else
    echo "SSL certificate already exists."
fi

# --- 7. Start Services ---
echo "[7/7] Starting services..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# --- 8. Setup auto-renewal cron ---
CRON_CMD="0 */12 * * * cd $APP_DIR && docker compose -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload"
(crontab -l 2>/dev/null | grep -v "certbot renew" ; echo "$CRON_CMD") | crontab -

echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "  URL:    https://$DOMAIN"
echo "  Health: https://$DOMAIN/health"
echo ""
echo "  Useful commands:"
echo "    cd $APP_DIR"
echo "    docker compose -f docker-compose.prod.yml ps        # Check status"
echo "    docker compose -f docker-compose.prod.yml logs -f    # Tail logs"
echo "    docker compose -f docker-compose.prod.yml down       # Stop all"
echo "    docker compose -f docker-compose.prod.yml up -d --build app  # Rebuild app"
echo ""

# Quick health check
echo "Waiting for services to start..."
sleep 10
if curl -sf "http://localhost:8001/health" > /dev/null 2>&1; then
    echo "Health check PASSED"
else
    echo "Health check pending... services may still be starting."
    echo "Run: docker compose -f docker-compose.prod.yml logs -f app"
fi
