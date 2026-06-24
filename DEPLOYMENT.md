# PrimeStack MOTO POS Deployment Guide

## Prerequisites
- A domain name (optional but recommended)
- A Stripe account
- A DigitalOcean account (or any VPS provider)

---

## Part 1: Stripe Setup (IMPORTANT!)

### 1.1 Get Your Live API Keys
1. Go to https://dashboard.stripe.com/apikeys
2. Make sure "Test mode" is **OFF** (toggle in top right corner)
3. Copy these keys and save them in a safe place:
   - **Secret key**: `sk_live_...`
   - **Publishable key**: `pk_live_...`

### 1.2 Create Stripe Webhook Endpoint
1. In Stripe Dashboard, go to **Developers** → **Webhooks** → **Add endpoint**
2. For **Endpoint URL**, you have two options:
   - **Option A (Temporary for testing)**: Use ngrok (see below)
   - **Option B (Permanent)**: Use your domain (e.g., `https://yourdomain.com/webhooks/stripe`)
3. For **Events to send**, click **Select events** and choose:
   - **Payment Intent**:
     - `payment_intent.succeeded`
     - `payment_intent.processing`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
   - **Charge**:
     - `charge.refunded`
     - `charge.refund.updated`
4. Click **Add endpoint**
5. On the next page, click **Reveal** under "Signing secret" and copy this! This is your `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`).

---

## Part 2: Deploying with Docker Compose (DigitalOcean)

### 2.1 Create a DigitalOcean Droplet
1. Sign up or log in to https://digitalocean.com/
2. Click **Create** → **Droplet**
3. Choose:
   - **Distribution**: Ubuntu 24.04 (LTS) x64
   - **Plan**: Basic (starts at $6/month - 2GB RAM, 1 CPU)
   - **Region**: Choose the one closest to your users
   - **Authentication**: Choose SSH key (recommended) or password
4. Click **Create Droplet** and wait for it to be ready!

### 2.2 SSH Into Your Droplet
1. Copy your Droplet's IP address from DigitalOcean dashboard
2. Open PowerShell (Windows) or Terminal (Mac/Linux) and run:
   ```bash
   ssh root@your-droplet-ip
   ```
   (Replace `your-droplet-ip` with your actual IP)

### 2.3 Install Docker & Docker Compose
Run these commands on your Droplet:
```bash
# Update system packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add your user to docker group
usermod -aG docker $USER

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 2.4 Upload Your Project
Option 1: Use SFTP (FileZilla, WinSCP) to upload your entire project folder to `/root/primestack-pos`

Option 2: If your project is on GitHub, clone it:
```bash
git clone https://github.com/yourusername/primestack-pos.git
cd primestack-pos
```

### 2.5 Create Production .env File
On your Droplet, in your project folder, create a `.env` file:
```bash
nano .env
```
Paste this content and replace the placeholders with your actual keys:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://primestack:your_secure_db_password@postgres:5432/primestack_pos
JWT_SECRET=your_very_secure_jwt_secret_change_this!
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
LOG_LEVEL=info
```
Press `Ctrl+O` then `Enter` to save, then `Ctrl+X` to exit.

### 2.6 Update docker-compose.yml
Open `docker-compose.yml` and update the POSTGRES_PASSWORD to match your `.env` file's password.

### 2.7 Start the Application
```bash
docker compose up -d --build
```
Wait a minute for everything to start up!

### 2.8 Set Up Nginx & SSL (HTTPS)
1. Install Nginx:
   ```bash
   apt install nginx -y
   ```

2. Create an Nginx config file:
   ```bash
   nano /etc/nginx/sites-available/primestack-pos
   ```
   Paste this (replace `yourdomain.com` with your actual domain):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   Save and exit.

3. Enable the site:
   ```bash
   ln -s /etc/nginx/sites-available/primestack-pos /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t
   systemctl restart nginx
   ```

4. Install SSL certificate with Let's Encrypt:
   ```bash
   apt install certbot python3-certbot-nginx -y
   certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
   Follow the prompts!

---

## Part 3: Access Your Application
Once deployed, you can access:
- **POS App**: `https://yourdomain.com/`
- **Merchant Dashboard**: `https://yourdomain.com/merchant`
- **Admin Dashboard**: `https://yourdomain.com/admin`

Default Admin Login (change immediately!):
- Email: admin@primestack.com
- Password: Admin123!

---

## Part 4: Update Stripe Webhook with Your Domain
1. Go back to Stripe Dashboard → Developers → Webhooks
2. Edit your webhook endpoint
3. Update the URL to `https://yourdomain.com/webhooks/stripe`
4. Save!

---

## Troubleshooting
- Check logs: `docker compose logs -f`
- Restart containers: `docker compose restart`
