# ADR Template: [Short Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded]  
**Date**: YYYY-MM-DD  
**Deciders**: [List of people involved]  
**Technical Story**: [Link to JIRA/GitHub issue]

---

## Context and Problem Statement

[Describe the context and problem statement concisely. What architectural decision are we facing? What forces are at play?]

**Example:**
> We need to choose a database for the FlashFusion MVP. The system must support multi-tenant data isolation, scale to 10K+ orgs, and integrate with our existing Lovable Cloud infrastructure.

---

## Decision Drivers

* [driver 1, e.g., cost, performance, security]
* [driver 2]
* [driver 3]
* ...

**Example:**
* **Multi-tenancy**: Must enforce org-scoped data access (RLS)
* **Developer Experience**: Fast local setup, minimal ops overhead
* **Cost**: Stay within $200/month budget for first 1K users
* **Ecosystem**: Integrates with Lovable Cloud deployment pipeline

---

## Considered Options

* [option 1]
* [option 2]
* [option 3]
* ... <!-- numbers of options can vary -->

**Example:**
1. **PostgreSQL (Supabase)**: Managed Postgres + RLS + Auth
2. **MongoDB Atlas**: NoSQL, flexible schema, global distribution
3. **Firebase Firestore**: Real-time NoSQL, good DX
4. **Custom MySQL**: Self-hosted, full control

---

## Decision Outcome

**Chosen option**: "[option 1]", because [justification].

**Positive Consequences**:
* [e.g., improved performance]
* [e.g., developer happiness]

**Negative Consequences**:
* [e.g., technical debt]
* [e.g., vendor lock-in]

**Example:**
> **Chosen**: PostgreSQL (Supabase)
> - ✅ Native RLS for multi-tenancy
> - ✅ Managed by Lovable Cloud (zero ops)
> - ✅ Excellent TypeScript support (auto-generated types)
> - ❌ Vendor lock-in (migration cost if leaving Supabase)
> - ❌ PostgreSQL scalability limits (sharding needed >10K orgs)

---

## Pros and Cons of the Options

### [option 1]

[example | description | pointer to more information]

* ✅ Good, because [argument a]
* ✅ Good, because [argument b]
* ❌ Bad, because [argument c]
* ... <!-- numbers of pros and cons can vary -->

**Example (PostgreSQL):**
* ✅ Mature, battle-tested (used by millions)
* ✅ ACID transactions (data integrity)
* ✅ Rich query capabilities (joins, aggregations)
* ✅ RLS built-in (security by default)
* ❌ Vertical scaling limits (single master bottleneck)
* ❌ Schema migrations can be risky (downtime)

### [option 2]

[example | description | pointer to more information]

* ✅ Good, because [argument a]
* ❌ Bad, because [argument b]
* ...

**Example (MongoDB):**
* ✅ Flexible schema (easy to evolve data models)
* ✅ Horizontal scaling (sharding out of the box)
* ❌ No native RLS (must implement in app layer)
* ❌ Limited query capabilities vs SQL (no joins)
* ❌ Eventual consistency (harder to reason about)

### [option 3]

...

---

## Validation

**How will we know this decision is correct?**

* [Success metric 1]
* [Success metric 2]
* [Failure scenario]

**Example:**
* ✅ Success: Support 1K orgs within first 6 months with no DB incidents
* ✅ Success: Developer can add a new table in <10 minutes
* ❌ Failure: DB latency >500ms for 95th percentile queries
* ❌ Failure: RLS breach (cross-org data leak)

---

## Links

* [Link to relevant documentation]
* [Link to related ADR]
* [Link to benchmark results]
* ...

**Example:**
* [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
* [PostgreSQL vs MongoDB Benchmark (2024)](https://example.com)
* [ADR-002: Choice of React vs Vue](./ADR-002-react-vs-vue.md)

---

## Notes

[Optional: Additional context, trade-offs considered, or follow-up items]

**Example:**
> We evaluated DynamoDB but ruled it out due to complexity of modeling multi-tenant data without a dedicated partition key per tenant. May revisit if we need global distribution (GDPR data residency).
