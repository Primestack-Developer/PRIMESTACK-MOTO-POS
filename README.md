# PrimeStack MOTO POS System

## 📖 Overview

**PrimeStack MOTO POS** is a full-featured, multi-tenant Mail Order / Telephone Order payment processing platform. It provides a complete admin → merchant → POS device workflow with built-in customer verification, real-time chat, payment tracking, and more.

---

## 🛠️ Tech Stack

### Backend
- **Node.js** (v20+) + **Express** 5.x - Web server
- **Prisma** ORM - Database access layer
- **SQLite** (development) / **PostgreSQL** (production) - Databases
- **Stripe** - Payment gateway
- **JWT** - Authentication (role-based: admin, merchant, pos)
- **bcrypt** - Password hashing
- **Zod** - Schema validation
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting

### Frontends (All React + Vite)
- **Admin Dashboard** (Port 3002) - Merchant/device/order management
- **Merchant Dashboard** (Port 3003) - Merchant self-service
- **POS App** (Port 3004) - Point-of-sale terminal

### Key Libraries (Frontend)
- **Recharts** - Data visualization (charts)
- **Custom CSS** (no heavy frameworks like Tailwind)
- **React Hooks** (useState, useEffect, useRef, useCallback)

---

## 🏗️ System Architecture

```
                    ┌───────────────────────┐
                    │   Admin Dashboard     │ (http://localhost:3002)
                    │ - Manage Merchants    │
                    │ - Approve Verifications│
                    │ - Reset Merchant PWs  │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Backend API         │ (http://localhost:3001)
                    │ (Express + Prisma +   │
                    │  Stripe)              │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
┌───────────▼───────────┐ ┌─────▼──────────────┐ ┌──▼─────────────────────┐
│  Merchant Dashboard   │ │  POS Devices (any) │ │  Stripe API            │
│ (http://localhost:3003│ │ http://localhost:  │ │ Payment Processing     │
│ - Manage POS Devices  │ │3004                │ └───────────────────────┘
│ - Add/Verify Customers│ │ - Process Payments │
│ - View Orders/Pays    │ │ - Activate w/ Code │
│ - Chat with Admin     │ │ - Walk-in Customers│
└───────────────────────┘ └────────────────────┘
```

---

## 🚀 Getting Started

### 1. Installation

#### Install All Dependencies
```bash
# Root/Backend
npm install

# Each Frontend
cd admin-dashboard && npm install
cd ../merchant-dashboard && npm install
cd ../pos-app && npm install
```

### 2. Configure Environment Variables

Create/edit `.env` in project root:
```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Auth
JWT_SECRET="your-super-secret-jwt-key-here-change-me-in-production!"

# Stripe
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Server
PORT=3001
```

### 3. Database Setup

```bash
# Run migrations
npx prisma migrate dev

# Seed with default admin
node seed.js
```

This will create a default admin user:
- **Email**: admin@primestack.com
- **Password**: admin123

---

## ▶️ Running the System

### Option A: Start All Services with Batch File (Windows)
Just **double-click `start-all.bat`**! This will open 4 separate terminal windows automatically!

### Option B: Start Manually

Start each service in its own terminal:

```bash
# 1. Start Backend API (Port 3001)
npm run dev

# 2. Start Admin Dashboard (Port 3002)
cd admin-dashboard && npm run dev

# 3. Start Merchant Dashboard (Port 3003)
cd merchant-dashboard && npm run dev

# 4. Start POS App (Port 3004)
cd pos-app && npm run dev
```

---

## 👥 User Roles & Capabilities

### 1. Admin

**Login**: http://localhost:3002

**What admins can do:**
- ✅ Create new merchant accounts
- ✅ Reset merchant passwords
- ✅ Suspend/activate merchant accounts
- ✅ Delete merchant accounts (removes ALL their data!)
- ✅ Add POS devices for merchants (with activation codes)
- ✅ View, filter, and search all POS devices
- ✅ View, filter, and search all orders/payments
- ✅ Review and approve/reject customer verifications
- ✅ View transaction logs
- ✅ View Stripe webhook events
- ✅ Chat with individual merchants
- ✅ View notifications

### 2. Merchant

**Login**: http://localhost:3003 (use credentials created by admin)

**What merchants can do:**
- ✅ View dashboard stats (total revenue, orders, failed payments, etc.)
- ✅ Manage their POS devices
- ✅ Add customers
- ✅ Submit customers for verification (with docs)
- ✅ View their orders, payments, and transactions
- ✅ Chat with admin
- ✅ Update their profile
- ✅ Change their password
- ✅ Receive notifications (with sound!)

### 3. POS Device

**Login**: http://localhost:3004 (use activation code from merchant dashboard)

**What POS devices can do:**
- ✅ Activate using unique activation code
- ✅ Process walk-in payments (no customer required)
- ✅ Process payments for verified registered customers
- ✅ Create new customers
- ✅ Polls for payment statuses automatically
- ✅ Shows success/failure sounds
- ✅ Checks if merchant is suspended

---

## 💳 Complete End-to-End Workflow

### Step 1: Admin Creates Merchant
1. Admin logs in at http://localhost:3002
2. Go to **Merchants → Add Merchant**
3. Fill out merchant details
4. **Save** - you'll see a temporary password to give to the merchant!

### Step 2: Merchant Logs In & Uses Dashboard
1. Merchant receives credentials from admin
2. Logs in at http://localhost:3003
3. Sees their dashboard with revenue stats, recent orders, etc.

### Step 3: Create & Activate POS Device
1. **Admin Option**: In Admin Dashboard → Merchant Detail → click 🖥️ "Add POS Device"
2. **Merchant Option**: In Merchant Dashboard → POS Devices → click "+ Add POS"
3. Either way, an activation code is generated!
4. Open http://localhost:3004 (POS App)
5. Enter the activation code to activate the POS!

### Step 4: Add & Verify Customer
1. In Merchant Dashboard → Customers → "+ Add Customer"
2. Fill out customer details
3. Click on the customer, then "Submit for Verification"
4. Upload ID/docs, add notes, submit!
5. Admin receives notification, reviews, approves/rejects!

### Step 5: Process MOTO Payment
1. Open POS App, enter amount and (optional) description
2. Choose: Walk-in Customer OR select a Verified Registered Customer
3. Click "Proceed to Payment"
4. Stripe Payment Link opens in a new tab
5. Customer enters card details and pays
6. POS App automatically updates payment status!
7. Both admin and merchant see the new order in their dashboards!

---

## 📊 Database Schema (Key Models)

### Admin
Stores admin accounts (id, email, hashed password, name)

### Merchant
Stores merchant accounts (merchantId, email, businessName, hashed password, status)

### POSDevice
Stores POS devices (posId, merchantId, activationCode, status, last seen time)

### Customer
Stores merchant customers (merchantId, name, email, billing address, Stripe ID)

### CustomerVerification
Tracks customer verification status (document URLs, status, reviewed by/at)

### Order
Stores orders (orderId, merchantId, posId, customerId, amount, paymentIntentId)

### Payment
Stores successful/failed payments (Stripe charge ID, card info, receipt URL)

### ChatMessage
Stores admin-merchant chat history (sender, message, read status)

---

## 🔑 Key Features

### Customer Verification
- Merchants can submit customers for verification with documents
- Admin must approve verified customers before they can be used for payments
- Prevents fraud!

### Merchant Suspension
- Admin can suspend a merchant account at any time
- Suspending a merchant **automatically disables all their POS devices**
- Reactivating a merchant **automatically re-enables all their POS devices**

### Admin-Mercant Chat
- Built-in real-time (polling) chat between admin and merchants
- Shows unread counts
- Notifies on new messages!

### Notifications
- Admin and merchants receive notifications for events like:
  - New merchant created
  - POS device activated
  - Payment received
  - Customer verification request
  - Password reset
- Sounds play for new merchant notifications!

### Payment Links
- Uses Stripe Payment Links for secure payment processing
- POS automatically updates status once payment is made!

---

## 🌐 API Endpoints (Selected Highlights)

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /admin/register | Register new admin |
| POST | /admin/login | Admin login |
| GET | /admin/merchants | List all merchants |
| POST | /admin/merchants | Create new merchant |
| POST | /admin/merchants/:merchantId/status | Toggle merchant active/suspended |
| POST | /admin/merchants/:merchantId/pos-devices | Create new POS device for merchant |
| POST | /admin/merchants/:merchantId/reset-password | Reset merchant password |
| DELETE | /admin/merchants/:merchantId | Delete merchant (cascades!) |
| GET | /admin/verifications | List customer verifications |

### Merchant Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /merchant/login | Merchant login |
| GET | /merchant/pos-devices | List merchant's POS devices |
| GET | /merchant/notifications | Get merchant's notifications |
| GET / POST | /merchant/chat | Get/send chat messages with admin |

### POS Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /pos/activate | Activate POS with code |
| POST | /pos/moto/orders | Create MOTO order |
| GET | /pos/moto/orders/:orderId | Poll order/payment status |

### Webhook Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /webhooks/stripe | Stripe webhook receiver |

---

## 📂 Project Structure

```
PRIMESTACK MOTO POS/
├── index.js               # Backend Express server
├── package.json           # Backend dependencies
├── seed.js                # Database seeder
├── start-all.bat          # Start all services (Windows)
├── .env                   # Environment variables
├── prisma/
│   ├── schema.prisma      # Prisma DB schema (SQLite)
│   ├── schema.production.prisma # PostgreSQL schema
│   ├── migrations/        # DB migration files
│   └── dev.db             # SQLite development DB
├── admin-dashboard/       # Admin Dashboard (React + Vite)
│   ├── src/App.jsx        # Main app component
│   └── package.json
├── merchant-dashboard/    # Merchant Dashboard (React + Vite)
│   ├── src/App.jsx        # Main app component
│   └── package.json
└── pos-app/               # POS Application (React + Vite)
    ├── src/App.jsx        # Main app component
    └── package.json
```

---

## ⚙️ Default Ports

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3001 | http://localhost:3001 |
| Admin Dashboard | 3002 | http://localhost:3002 |
| Merchant Dashboard | 3003 | http://localhost:3003 |
| POS App | 3004 | http://localhost:3004 |

---

## 🔒 Security Notes

1. **Never expose your `.env` file!**
2. **Change `JWT_SECRET` and use strong passwords in production!**
3. All passwords are **bcrypt-hashed** - we never store plaintext passwords!
4. Customer verification prevents unauthorized usage!

---

## 🎉 That's it!

You're now ready to use the PrimeStack MOTO POS system! If you have any issues, check the individual terminal windows for error messages!
