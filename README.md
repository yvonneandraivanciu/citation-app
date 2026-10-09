# Cite. — Quebec Legal Citation Generator

A production-ready SaaS web app that generates Quebec/Canadian legal citations compliant with the *Guide des références juridiques du Québec*. Built with Next.js, TypeScript, PostgreSQL, and audited against the official citation guide.

**[Live Demo](https://citation-app-chi.vercel.app)** | **[GitHub](https://github.com/yvonneandraivanciu/citation-app)**

---

## ✨ Key Features

- **Citation Formatting**: Generates 20+ citation formats (cases, statutes, legislation, jurisprudence, etc.) per the official Quebec legal citation guide
- **CanLII Integration**: Real-time case metadata via CanLII API with intelligent 2-tier caching (in-memory + Postgres)
- **Global Quota Management**: Shared daily API quota (5,000 req/day) with circuit breaker protecting all users
- **Negative Caching**: Confirmed "not found" cases are cached, preventing redundant API calls
- **Production Monitoring**: Sentry integration across all error paths with actionable warnings
- **Email Authentication**: Verification codes + password reset flow via Resend
- **Comprehensive Testing**: 182 Vitest unit tests covering auth flows, API clients, DB layer, and French/timezone edge cases

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 18, TypeScript, CSS modules |
| **Backend** | Next.js API routes, Node.js |
| **Database** | PostgreSQL (Neon), Drizzle ORM |
| **Auth** | JWT + bcrypt |
| **Email** | Resend |
| **External API** | CanLII REST API |
| **Monitoring** | Sentry |
| **Testing** | Vitest (182 tests) |
| **Deployment** | Vercel |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or Neon free tier)
- (Optional) Resend account for email, CanLII API key for case lookup

### Local Development

1. **Clone & install**
   ```bash
   git clone https://github.com/yvonneandraivanciu/citation-app
   cd citation-app
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Set required variables:
   ```
   JWT_SECRET=<openssl rand -base64 48>
   DATABASE_URL=postgres://...  # Neon pooled connection
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
   
   Optional:
   ```
   RESEND_API_KEY=re_...        # Email verification
   CANLII_API_KEY=...           # Case metadata lookup
   ```

3. **Set up database**
   ```bash
   npm run db:push              # Apply schema
   npm run db:migrate-data      # (Optional) seed data
   ```

4. **Run dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

5. **Run tests**
   ```bash
   npm test                     # Run all tests
   npm run test:watch           # Watch mode
   ```

---

## 📦 Deployment (Vercel)

### 1. Connect GitHub
- Go to https://vercel.com/new
- Import this repository
- Select `main` branch

### 2. Environment Variables
Add to Vercel dashboard:
- `JWT_SECRET` (required): `openssl rand -base64 48`
- `DATABASE_URL` (required): Neon pooled connection string
- `NEXT_PUBLIC_APP_URL` (required): Your deployed URL, e.g., `https://citation-app.vercel.app`
- `RESEND_API_KEY` (optional): For email features
- `CANLII_API_KEY` (optional): For case metadata

### 3. Deploy
Click **Deploy** → Vercel builds & deploys in ~2-3 minutes

---

## 🏗 Architecture Highlights

### 2-Tier Caching
Published legal cases don't change, so we cache aggressively:
- **Tier 1 (Memory)**: Per-process cache, fast but lost on restart
- **Tier 2 (Postgres)**: Shared across users & deployments, survives restarts

When User B cites a landmark decision that User A already looked up, we skip the API call entirely.

### Global Daily Quota
CanLII grants 5,000 requests/day per API key. We enforce this app-wide:
- Soft cap at 4,500 (500-request safety margin)
- Shared counter in Postgres (survives restarts, scales across instances)
- Degrades gracefully to URL-only parsing when quota exhausted
- Real-time monitoring via Sentry

### Rate Limiting
- Per-user auth endpoints: 5 attempts / 15 min → 30 min block
- Configurable per-endpoint for heavy usage (e.g., scraping)
- DB-backed so it survives process restarts

### Security
- **SSRF Protection** (`safe-fetch.ts`): Blocks private IPs, enforces public-only URLs, validates DNS, manual redirect handling
- **Auth**: JWT tokens + bcryptjs password hashing
- **Input Validation**: HTML escaping in email templates

---

## 📊 Testing

Run the full test suite (182 tests):
```bash
npm test
```

Coverage includes:
- ✅ Auth flows (register, verify, login, password reset)
- ✅ API client state machine & error handling
- ✅ Citation formatting against official guide
- ✅ Database layer with in-memory Postgres
- ✅ URL scraping & CanLII API integration
- ✅ French title parsing & timezone handling

---

## 🔧 Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm start` | Run production build locally |
| `npm test` | Run test suite |
| `npm run test:watch` | Watch mode (re-run on changes) |
| `npm run db:push` | Apply schema changes to database |
| `npm run db:generate` | Generate migrations from schema |
| `npm run db:studio` | Open Drizzle Studio (DB GUI) |

---

## 📈 Performance

- **Build time**: ~30s (Next.js)
- **Test suite**: ~4s (182 tests)
- **API response**: ~200ms (with cache hit) / ~800ms (API lookup)
- **Database**: Optimized queries with indexes on frequently-accessed columns

---

## 📝 Environment Variables Reference

See `.env.example` for all options. Required for deployment:

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing JWT tokens | `base64(48 random bytes)` |
| `DATABASE_URL` | Postgres connection (pooled) | `postgres://user:pass@host/db` |
| `NEXT_PUBLIC_APP_URL` | Public URL of deployed app | `https://citation-app.vercel.app` |

Optional (graceful degradation if missing):
- `RESEND_API_KEY`: Email API key
- `CANLII_API_KEY`: Legal case API key
- `NEXT_PUBLIC_SENTRY_DSN`: Error monitoring

---

## 🚨 Known Limitations

- **Single-instance rate limiting**: CanLII's per-second rate limiter is in-process memory. If deployed to 2+ instances (e.g., Vercel autoscaling), add a Postgres advisory lock. Daily quota counter is already distributed.
- **Turbopack**: Next.js 16 Turbopack has issues with Sentry. Uses SWC minifier instead.

---

## 📄 License

Private project. All rights reserved.

---

## 👤 Author

**Yvonne Andra Ivanciu**  
[GitHub](https://github.com/yvonneandraivanciu) | [LinkedIn](https://linkedin.com/in/yvonneandraivanciu)

---

## 🙏 Acknowledgments

- Citation guide: *[Guide des références juridiques du Québec](https://www.barreau.qc.ca/publications/guides/guide-references-juridiques-quebec)*
- Case data: [CanLII](https://www.canlii.org/) (Open Access)
- Infrastructure: [Vercel](https://vercel.com), [Neon](https://neon.tech), [Resend](https://resend.com)
