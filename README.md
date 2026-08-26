# NeuroPay AI

**Multi-Tenant Field-Service SaaS with AI-Powered Workflows**

NeuroPay AI is a production-ready SaaS platform for field service management, featuring tenant isolation, customer management, job scheduling, technician workflows, AI-assisted estimates and invoicing, and integrated payment processing.

## 🏗️ Architecture

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with multi-tenant isolation
- **Frontend**: React + TypeScript
- **Mobile**: React Native (Phase 1 skeleton)
- **AI/Workflows**: Extensible AI agent architecture
- **Auth**: JWT + 2FA (TOTP)
- **Payments**: Stripe integration (boundary layer)

## 📦 Project Structure

```
neuropay-ai/
├── packages/
│   ├── api/              # Express API server
│   │   ├── src/
│   │   │   ├── auth/     # Authentication & authorization
│   │   │   ├── tenants/  # Multi-tenant isolation
│   │   │   ├── customers/
│   │   │   ├── properties/
│   │   │   ├── jobs/
│   │   │   ├── technicians/
│   │   │   ├── estimates/
│   │   │   ├── invoices/
│   │   │   ├── ai/       # AI workflow engine
│   │   │   ├── payments/ # Payment integration boundary
│   │   │   ├── db/       # Database layer
│   │   │   └── middleware/
│   │   ├── tests/
│   │   └── migrations/
│   ├── web/              # React owner dashboard
│   └── mobile/           # React Native technician app
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Dockerfile.api
├── Dockerfile.web
├── .github/workflows/
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for sessions)

### Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run migrations
npm run migrate

# Start development servers
npm run dev
```

Access:
- API: http://localhost:3001
- Web: http://localhost:3000

### Testing

```bash
# Unit and integration tests
npm run test

# E2E tests
npm run test:e2e
```

## 📋 Phase 1 Features

### ✅ Core Infrastructure
- [x] Multi-tenant architecture with tenant isolation
- [x] JWT + 2FA authentication
- [x] Role-based access control (RBAC)
- [x] Database schema with migrations

### ✅ Entity Management
- [x] Tenants (organizations)
- [x] Users (with roles)
- [x] Customers
- [x] Properties
- [x] Jobs (service tickets)
- [x] Technicians
- [x] Estimates
- [x] Invoices

### ✅ Features
- [x] Owner dashboard (analytics, user management)
- [x] Technician mobile workflow
- [x] AI workflow architecture (boundary layer)
- [x] Payment integration boundary
- [x] Real-time job status tracking

### ✅ Quality
- [x] Unit tests (>80% coverage)
- [x] Integration tests
- [x] Type safety (TypeScript)
- [x] Error handling
- [x] API documentation

### ✅ DevOps
- [x] Docker support
- [x] GitHub Actions CI/CD
- [x] Database migrations
- [x] Environment configuration

## 🔐 Authentication Flow

```
User → Login → JWT + 2FA → Tenant Isolation → Role-Based Access
```

## 💾 Database Schema

### Core Tables
- `tenants` - Organizations
- `users` - Tenant users with roles
- `customers` - End customers
- `properties` - Customer properties
- `jobs` - Service jobs/tickets
- `technicians` - Field service technicians
- `estimates` - Service estimates (AI-assisted)
- `invoices` - Billing (AI-generated)
- `estimate_line_items` - Estimate details
- `invoice_line_items` - Invoice details

All tables include `tenant_id` for isolation.

## 🤖 AI Workflow Architecture

The AI layer is modular and extensible:
- **Estimate Engine**: Analyzes job details → suggests line items
- **Invoice Generator**: Calculates totals, applies tax, formats
- **Recommendation Engine**: Suggests next steps for technicians
- **Analytics Engine**: Insights on job patterns and pricing

## 💳 Payment Integration Boundary

Stripe integration via boundary layer:
- Create payment intents
- Handle webhooks
- Process refunds
- Tax calculations

## 📱 Mobile Technician Workflow

- Accept/reject job assignments
- Update job status in real-time
- Capture photos/notes
- View customer info
- Track time and materials
- Submit for review

## 👤 Owner Dashboard

- Business analytics
- Technician performance
- Customer management
- Revenue tracking
- User administration

## 📝 License

MIT

## 🤝 Contributing

See CONTRIBUTING.md for guidelines.

## 📞 Support

For issues and feature requests, see GitHub Issues.
