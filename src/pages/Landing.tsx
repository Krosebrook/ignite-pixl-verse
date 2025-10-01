import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap, Sparkles, LayoutGrid, Calendar, Target, Rocket, Wand2 } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: Sparkles,
      title: "AI Content Generation",
      description: "Create stunning text, images, videos, and music with advanced AI models",
    },
    {
      icon: LayoutGrid,
      title: "Multi-Channel Campaigns",
      description: "Plan and execute campaigns across all major social platforms",
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "AI-powered timing recommendations for maximum engagement",
    },
    {
      icon: Target,
      title: "Brand Consistency",
      description: "Automated brand kit enforcement across all content",
    },
    {
      icon: Wand2,
      title: "Template Marketplace",
      description: "Access thousands of professional templates and presets",
    },
    {
      icon: Rocket,
      title: "Performance Analytics",
      description: "Deep insights and predictions to optimize your strategy",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Zap className="h-6 w-6 text-primary" />
              <div className="absolute inset-0 bg-primary/20 blur-xl" />
            </div>
            <span className="text-xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              FlashFusion
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-hero hover:opacity-90">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background Image */}
        <div className="absolute inset-0 opacity-30">
          <img src="/src/assets/hero-bg.jpg" alt="" className="w-full h-full object-cover" />
        </div>
        {/* Glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: "1s" }} />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Create. Campaign.
              <span className="bg-gradient-hero bg-clip-text text-transparent"> Conquer.</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              The AI-powered creative studio that generates content, plans campaigns, and schedules posts across all platforms
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-hero hover:opacity-90 text-lg px-8 shadow-glow">
                  Start Creating Free
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="text-lg px-8 border-primary/50">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-background to-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything You Need to <span className="text-primary">Dominate</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From ideation to execution, FlashFusion provides all the tools modern creators need
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="p-6 bg-card border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow group animate-scale-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="mb-4 relative inline-block">
                    <div className="p-3 bg-gradient-card rounded-lg group-hover:scale-110 transition-transform">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Content?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of creators using FlashFusion to produce content 10x faster
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-hero hover:opacity-90 text-lg px-12 shadow-glow">
              Get Started Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 FlashFusion. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
