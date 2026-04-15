import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-aristo-gradient overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-aristo-orange-pale/50 blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-aristo-orange-light/30 blur-3xl animate-pulse-soft [animation-delay:1s]" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-aristo-beige/60 blur-3xl animate-float" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <span className="text-2xl font-bold text-gradient">Aristo</span>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="text-foreground/70 hover:text-foreground">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-aristo-sm hover:shadow-aristo hover:-translate-y-0.5 transition-all">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-20 pb-32 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-8 shadow-aristo-sm animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-soft" />
          Now in prototype — built for middle-school learners
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight animate-fade-in [animation-delay:0.1s]">
          Learn anything with your{" "}
          <span className="text-gradient">personal AI teacher</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl animate-fade-in [animation-delay:0.2s]">
          Aristo adapts to how you learn best — with voice, 3D models, quizzes,
          and an immersive teacher that explains things your way.
        </p>

        <div className="flex items-center gap-4 animate-fade-in [animation-delay:0.3s]">
          <Button
            asChild
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 rounded-xl text-base font-semibold shadow-aristo hover:shadow-aristo-lg hover:-translate-y-1 transition-all"
          >
            <Link href="/sign-up">Start learning free</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 px-8 rounded-xl text-base font-semibold border-border hover:bg-secondary transition-all"
          >
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* Features strip */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: "🎓",
            title: "Adaptive teaching",
            desc: "Aristo learns how you learn — adjusting style based on your quiz results.",
          },
          {
            icon: "🧊",
            title: "Live 3D models",
            desc: "See what you're learning. Aristo generates 3D models of topics in real time.",
          },
          {
            icon: "🎙️",
            title: "Voice-first",
            desc: "Talk to your teacher. Aristo listens, responds, and teaches with natural voice.",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="glass rounded-2xl p-6 shadow-warm hover:shadow-aristo transition-all hover:-translate-y-1 animate-fade-in"
          >
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
