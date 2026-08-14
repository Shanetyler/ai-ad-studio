# AI Ad Studio

You are an expert full-stack AI SaaS architect and developer. Create a complete, production-ready SaaS web application blueprint and implementation plan for EASY ADs that fully replicates the functionality, user experience, and business model of QuickFrame AI.

Core Product

An all-in-one AI-powered studio-quality video ad generator that allows brands, marketers, and businesses to create TV-ready and social-ready video commercials in minutes using generative AI, with director-level creative controls.

Exact Feature Parity with QuickFrame AI:

User Flows:

Paste website URL for automatic brand research (colors, products, tone, identity).

Brand profile builder with logo/product uploads and guidelines.

Multiple generation modes: Text/Prompt-to-Video, Image-to-Video, URL-to-Ad, Extend Video, Add Elements, Style/Effect Gallery.

Full pipeline: AI script writing, storyboard, consistent characters/products/locations, voiceover (script + generation), music/SFX, full video synthesis.

Advanced controls for shots, lighting, mood, pacing, multi-character dialogue.

AI editing assistant (natural language edits), timeline editor, scene replacement, compliance checks.

Project/asset library, collaboration, direct publishing to Meta, TikTok, Google Ads (and CTV placeholders).

Tech Requirements:

Modern Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui frontend.

Supabase (or equivalent) for auth, database, storage, realtime.

Stripe for payments and subscriptions.

Modular AI orchestration layer (easy to plug in models like OpenAI, Anthropic, Veo, Runway, ElevenLabs, etc.).

Credit-based usage system.

Robust job queues for long-running video generations.

Production-ready: auth, billing, rate limiting, error handling, analytics dashboard.

Subscription Tiers (with Credits System):

Free/Starter tier (limited credits, watermarks).

Pro tier (~$39–59/mo).

Business/Team tier (~$99–199/mo with seats and advanced features).

Enterprise (custom).

Include usage tracking, billing portal, top-ups, and annual options.

Deliverables to Produce:

Detailed system architecture diagram (components, data flow, AI pipeline).

Complete database schema (Supabase/Postgres).

API route and service layer structure.

UI/UX component breakdown and page flows.

Stripe integration plan for tiers and webhooks.

Credit consumption and job queue logic.

Full landing + marketing site structure (hero, features, pricing, examples).

Deployment and setup instructions (Vercel + Supabase + Stripe).

Modular extension points for new AI models and features.

Security, scalability, and monitoring recommendations.

Build this as a production-grade, scalable SaaS ready for launch. Provide the complete plan, key code structures, schemas, and implementation steps in a clear, organized way so a developer or AI coding agent can implement and deploy it efficiently. Prioritize clean architecture, best practices, and user experience that feels premium and cinematic like QuickFrame AI.

Start by outlining the project structure and high-level architecture, then dive into details.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f476afc9-59ff-4b6d-95b4-e7e62be37e42).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
