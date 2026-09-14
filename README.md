# NeuroPay AI

**Multi-Tenant Field-Service SaaS with AI-Powered Workflows**

NeuroPay AI is a production-ready SaaS platform for field service management, featuring tenant isolation, customer management, job scheduling, technician workflows, AI-assisted estimates and invoicing, and integrated payment processing.

## 🏗️ Architecture

- **Backend**: Node.js + Express + TypeScript (`packages/api`)
- **Database**: SQLite via `better-sqlite3`, multi-tenant row scoping
- **Frontend**: React + TypeScript + Vite (`packages/web`), served by the API
- **Auth**: JWT (HS256) + bcrypt; role-based access control
- **AI/Workflows**: pluggable estimator boundary (local heuristic → OpenAI)
- **Payments**: boundary layer, manual ↔ Stripe

The API serves the built web bundle, so a deployment is **one process and one URL**.

## 📦 Project Structure

```
neuropay-ai/
├── packages/
│   ├── api/                 # Express API + serves the built web app
│   │   └── src/
│   │       ├── ai/            # AI workflow engine (estimator)
│   │       ├── config/        # Environment configuration
│   │       ├── db/            # Connection, migrations, seed, repositories
│   │       ├── middleware/    # Auth, rate limiting
│   │       ├── routes/        # auth, domain, ai, system
│   │       └── tests/         # Jest + supertest suite
│   └── web/                 # React owner dashboard (Vite)
├── Dockerfile
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── render.yaml
├── DEPLOYMENT.md
├── .github/workflows/ci.yml
└── README.md
```

## 🚀 Quick Start

For production deployment, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

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

Access (single process — the API serves the built dashboard):
- App + API: http://localhost:8080
  - API base: `http://localhost:8080/api`
  - Health: `/health`  ·  Readiness: `/ready`

### Testing

```bash
npm run typecheck   # tsc across both workspaces
npm test            # Jest + supertest (auth, tenant isolation, workflow, hardening)
npm run build       # compile API + bundle web
```

## 📋 Implemented

### Core infrastructure
- [x] Multi-tenant architecture with row-level tenant isolation
- [x] JWT authentication (HS256) + bcrypt password hashing
- [x] Role-based access control (owner / admin / tech / viewer)
- [x] Database schema with idempotent, boot-time migrations
- [x] Login rate limiting and baseline security headers

### Entity management
- [x] Tenants, users (with roles), customers, properties
- [x] Jobs (service tickets), technicians, estimates, invoices, payments

### Features
- [x] Owner dashboard (counts, revenue, outstanding balance)
- [x] Technician job workflow (assign, status transitions)
- [x] AI workflow architecture (pluggable estimator boundary)
- [x] Payment integration boundary (manual ↔ Stripe)

### Quality & DevOps
- [x] Unit + integration tests (auth, tenant isolation, workflow, hardening)
- [x] Type safety (TypeScript, strict mode)
- [x] Dockerfile + `docker-compose.{dev,prod}.yml`
- [x] GitHub Actions CI (typecheck → test → build)
- [x] Environment configuration via `.env` (see `.env.example`)

> **Not yet implemented:** 2FA/TOTP, the React Native technician app, Stripe
> webhook handling, and real-time (websocket) updates. The AI estimator runs a
> local heuristic model until `OPENAI_API_KEY` is set. Tracked as future work.

## 🔐 Authentication Flow

```
User → Login (bcrypt verify) → JWT issued → Tenant scoping from token → Role-Based Access
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
- `invoices` - Billing records
- `payments` - Payments recorded against invoices
- `ai_jobs` - AI estimate runs (input, output, status)

Every domain table carries `tenant_id`, and every query is scoped by it. A
request can never read or write another tenant's rows.

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
