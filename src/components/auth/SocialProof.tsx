import { Star, Users, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialProofProps {
  className?: string;
}

const testimonials = [
  {
    quote: "Increased our content output by 10x while maintaining brand consistency.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechStart Inc",
  },
  {
    quote: "The AI understands our brand voice perfectly. Game changer for our team.",
    author: "Michael Torres",
    role: "Creative Lead",
    company: "BrandForge",
  },
  {
    quote: "Saved 20+ hours per week on content creation. Absolutely essential.",
    author: "Emily Parker",
    role: "Content Manager",
    company: "GrowthLabs",
  },
];

const stats = [
  { value: "50K+", label: "Active creators", icon: Users },
  { value: "2M+", label: "Assets generated", icon: Zap },
  { value: "4.9", label: "Star rating", icon: Star },
];

export function SocialProof({ className }: SocialProofProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Stats row */}
      <div className="flex items-center justify-center gap-6 text-center">
        {stats.map((stat, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <stat.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-lg font-bold">{stat.value}</span>
            </div>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Trusted by teams worldwide</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Rotating testimonial */}
      <TestimonialCarousel testimonials={testimonials} />
    </div>
  );
}

interface TestimonialCarouselProps {
  testimonials: typeof testimonials;
}

function TestimonialCarousel({ testimonials }: TestimonialCarouselProps) {
  // Simple static display with first testimonial - could be enhanced with rotation
  const testimonial = testimonials[0];

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
      <div className="flex gap-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-3 w-3 fill-primary text-primary" />
        ))}
      </div>
      <blockquote className="text-sm text-foreground/90 italic mb-3">
        "{testimonial.quote}"
      </blockquote>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-xs font-bold text-white">
          {testimonial.author.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <p className="text-sm font-medium">{testimonial.author}</p>
          <p className="text-xs text-muted-foreground">
            {testimonial.role}, {testimonial.company}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SocialProofCompact({ className }: SocialProofProps) {
  return (
    <div className={cn("flex items-center justify-center gap-4 text-xs text-muted-foreground", className)}>
      <div className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        <span>50K+ creators</span>
      </div>
      <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
      <div className="flex items-center gap-1">
        <Star className="h-3 w-3 fill-primary text-primary" />
        <span>4.9 rating</span>
      </div>
      <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
      <div className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3 text-green-500" />
        <span>10x faster</span>
      </div>
    </div>
  );
}
