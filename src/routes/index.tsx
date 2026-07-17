import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Film, Wand2, Palette, Rocket, Check, Play } from "lucide-react";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EASY ADs — AI Video Ad Studio" },
      {
        name: "description",
        content:
          "Generate cinematic, TV-ready video commercials in minutes. Brand-aware AI script, storyboard, voiceover and video generation.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <LogoBar />
      <Features />
      <Modes />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md [background:var(--gradient-ember)]">
            <Film className="h-4 w-4 text-ember-foreground" />
          </div>
          <span className="font-display text-xl">EASY ADs</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#modes" className="hover:text-foreground">Modes</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/auth"><Button variant="hero" size="sm">Start creating</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1080}
          className="h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-hero" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3 text-primary" />
          Cinematic AI ads — from prompt to publish
        </div>
        <h1 className="mx-auto max-w-4xl text-5xl leading-[1.05] md:text-7xl">
          Studio-quality video ads,<br />
          <span className="text-gradient-ember italic">generated in minutes.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          EASY ADs is the AI commercial studio for modern brands. Paste your URL,
          pick a mood, and ship TV-ready and social-ready spots — script, voiceover,
          music, and video, all generated with director-level control.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button variant="hero" size="xl">
              Create your first ad <ArrowRight />
            </Button>
          </Link>
          <Button variant="cinematic" size="xl">
            <Play /> Watch reel
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          30 free credits on signup · No credit card required
        </p>
      </div>
    </section>
  );
}

function LogoBar() {
  const logos = ["ATLAS", "NORTHWIND", "LUMEN", "VANTA", "OBSIDIAN", "MERIDIAN"];
  return (
    <section className="border-y border-border/40 bg-card/30">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6 py-8 text-sm tracking-[0.3em] text-muted-foreground/70">
        {logos.map((l) => <span key={l} className="font-display">{l}</span>)}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Palette, title: "Brand-aware from URL", body: "Paste a link — we extract colors, tone, products, and audience into a living brand profile." },
    { icon: Wand2, title: "Director-level control", body: "Guide shots, lighting, pacing, dialogue, and mood. AI edits with natural language." },
    { icon: Film, title: "Full pipeline in one place", body: "Script → storyboard → voiceover → music → video. Consistent characters and products." },
    { icon: Rocket, title: "Publish anywhere", body: "One-click export to Meta, TikTok, Google Ads, and CTV placements." },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">The studio</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Every craft. One canvas.</h2>
        <p className="mt-4 text-muted-foreground">
          The whole commercial production stack — reimagined as a fast, cinematic AI workflow.
        </p>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.map((f) => (
          <div key={f.title} className="panel p-6">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Modes() {
  const modes = [
    "Prompt → Video", "Image → Video", "URL → Ad",
    "Extend Video", "Add Elements", "Style Gallery",
  ];
  return (
    <section id="modes" className="mx-auto max-w-7xl px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Modes</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Six ways to start.</h2>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modes.map((m, i) => (
          <div key={m} className="group panel relative overflow-hidden p-8 transition-all hover:border-primary/50">
            <div className="text-xs text-muted-foreground">0{i + 1}</div>
            <div className="mt-6 font-display text-2xl">{m}</div>
            <div className="mt-6 h-1 w-12 [background:var(--gradient-ember)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: "Starter", price: "$0", tag: "Try it free", credits: "30 credits / mo", features: ["1 brand", "720p, watermark", "Prompt & image modes", "Community support"] },
    { name: "Pro", price: "$49", tag: "For creators", featured: true, credits: "1,500 credits / mo", features: ["3 brands", "1080p, no watermark", "All modes", "Priority queue", "Publish to Meta/TikTok"] },
    { name: "Business", price: "$149", tag: "For teams", credits: "5,000 credits / mo", features: ["Unlimited brands", "4K, no watermark", "5 seats", "Advanced controls", "Google Ads publishing"] },
    { name: "Enterprise", price: "Custom", tag: "For brands at scale", credits: "Custom credits", features: ["SSO & SAML", "Dedicated queue", "Custom models", "White-glove onboarding"] },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Pricing</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Credits that flex with you.</h2>
        <p className="mt-4 text-muted-foreground">Start free. Top up any time. Annual saves 20%.</p>
      </div>
      <div className="mt-14 grid gap-6 lg:grid-cols-4">
        {tiers.map((t) => (
          <div key={t.name} className={`panel flex flex-col p-8 ${t.featured ? "border-primary/50 shadow-[var(--shadow-glow)]" : ""}`}>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{t.tag}</div>
            <div className="mt-2 font-display text-2xl">{t.name}</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-5xl">{t.price}</span>
              {t.price !== "Custom" && <span className="text-sm text-muted-foreground">/mo</span>}
            </div>
            <div className="mt-2 text-sm text-primary">{t.credits}</div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/auth">
                <Button variant={t.featured ? "hero" : "cinematic"} className="w-full">
                  {t.name === "Enterprise" ? "Contact sales" : "Get started"}
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-28">
      <div className="panel grain relative overflow-hidden p-16 text-center">
        <h2 className="mx-auto max-w-2xl text-4xl md:text-5xl">
          Your next hero spot is <span className="text-gradient-ember italic">one prompt away.</span>
        </h2>
        <div className="mt-8">
          <Link to="/auth"><Button variant="hero" size="xl">Start free <ArrowRight /></Button></Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4" /> © {new Date().getFullYear()} EASY ADs
        </div>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link to="/auth" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
