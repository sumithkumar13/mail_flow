import { Link } from "wouter";
import { ArrowRight, CalendarClock, Paperclip, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import meshBg from "@assets/generated_images/abstract_mesh_gradient_background_in_indigo_and_violet.png";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src={meshBg} 
          alt="Background" 
          className="w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="text-2xl font-display font-bold tracking-tight">MailFlow</div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 container mx-auto px-6 pt-20 pb-32 text-center">

        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
          AI-powered emails <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-pink-400">
            sent via Gmail SMTP
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          Write emails with AI, then send them through your Gmail SMTP — with drafts, scheduling, bulk campaigns, and attachments built in.
        </p>

        <div className="mb-12" />

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
          <Link href="/auth?tab=login">
            <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              Start sending
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>

          <Link href="/auth?tab=signup">
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-lg border-white/15 bg-transparent hover:bg-white/5"
            >
              New user? Sign up
            </Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="relative z-10 container mx-auto px-6 py-24 border-t border-white/5">
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { 
              icon: CalendarClock,
              title: "Drafts + Scheduling",
              desc: "Save drafts while you iterate, then schedule sends when you’re ready. Drafts won’t auto-send until you schedule or send." 
            },
            { 
              icon: Paperclip,
              title: "Bulk + Attachments",
              desc: "Send to one recipient or a list. Attach files with previews so you know exactly what will be sent." 
            },
            { 
              icon: Sparkles,
              title: "AI Email Generator",
              desc: "Generate a subject + message instantly, then edit and save as a draft before sending." 
            }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary mb-6">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
