import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";

const PRICING_TIERS = [
  {
    name: 'Starter',
    icon: Zap,
    price: '$29',
    period: '/month',
    description: 'Perfect for individuals and small projects',
    features: [
      'Up to 5 layers per video',
      '720p-1080p resolution',
      '10 video minutes/month',
      '100 image generations/month',
      'Basic transitions & effects',
      'Standard render queue (10-15 min)',
      'Community support'
    ],
    limitations: [
      'Watermark on exports',
      'No AI voice cloning',
      'No custom branding'
    ],
    cta: 'Start Free Trial',
    popular: false
  },
  {
    name: 'Pro',
    icon: Sparkles,
    price: '$99',
    period: '/month',
    description: 'For professionals and growing businesses',
    features: [
      'Up to 15 layers per video',
      '4K resolution (YouTube) / 1080p (TikTok)',
      '60 video minutes/month',
      '500 image generations/month',
      'Advanced effects & color grading',
      'AI voice cloning',
      'Auto-captions',
      'No watermark',
      'Priority render queue (5-8 min)',
      'Email support'
    ],
    limitations: [],
    cta: 'Upgrade to Pro',
    popular: true
  },
  {
    name: 'Enterprise',
    icon: Crown,
    price: 'Custom',
    period: '',
    description: 'For agencies and large-scale operations',
    features: [
      'Unlimited layers',
      '8K resolution',
      'Unlimited video minutes',
      'Unlimited image generations',
      'Custom branding & effects',
      'API access',
      'Priority rendering (<5 min)',
      'Dedicated account manager',
      '99.9% SLA guarantee',
      'Custom integrations',
      'White-label options'
    ],
    limitations: [],
    cta: 'Contact Sales',
    popular: false
  }
];

const FEATURES_COMPARISON = [
  {
    category: 'Video Generation',
    features: [
      { name: 'Max Layers', starter: '5', pro: '15', enterprise: 'Unlimited' },
      { name: 'Resolution', starter: '1080p', pro: '4K', enterprise: '8K' },
      { name: 'Video Minutes/Month', starter: '10', pro: '60', enterprise: 'Unlimited' },
      { name: 'Render Speed', starter: '10-15 min', pro: '5-8 min', enterprise: '<5 min' },
      { name: 'Watermark', starter: 'Yes', pro: 'No', enterprise: 'No' }
    ]
  },
  {
    category: 'Advanced Features',
    features: [
      { name: 'AI Voice Cloning', starter: false, pro: true, enterprise: true },
      { name: 'Auto-Captions', starter: false, pro: true, enterprise: true },
      { name: 'Color Grading', starter: false, pro: true, enterprise: true },
      { name: 'Custom Branding', starter: false, pro: false, enterprise: true },
      { name: 'API Access', starter: false, pro: false, enterprise: true }
    ]
  }
];

export default function Pricing() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Studio-Grade Pricing"
          description="Choose the perfect plan for professional video and content creation"
        />

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {PRICING_TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <Card
                key={tier.name}
                className={`relative p-8 ${
                  tier.popular
                    ? 'border-primary shadow-lg scale-105'
                    : ''
                }`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{tier.name}</h3>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                  {tier.description}
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>
                </div>

                <Button
                  className="w-full mb-6"
                  variant={tier.popular ? 'default' : 'outline'}
                  size="lg"
                >
                  {tier.cta}
                </Button>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Features:</p>
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}

                  {tier.limitations.length > 0 && (
                    <>
                      <p className="text-sm font-semibold text-muted-foreground mt-4">
                        Limitations:
                      </p>
                      {tier.limitations.map((limitation, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-sm text-muted-foreground">
                            • {limitation}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Features Comparison Table */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6">Detailed Comparison</h2>
          
          {FEATURES_COMPARISON.map((section) => (
            <div key={section.category} className="mb-8 last:mb-0">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                {section.category}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Feature</th>
                      <th className="text-center py-3 px-4 font-medium">Starter</th>
                      <th className="text-center py-3 px-4 font-medium">Pro</th>
                      <th className="text-center py-3 px-4 font-medium">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.features.map((feature, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-3 px-4 text-sm">{feature.name}</td>
                        <td className="py-3 px-4 text-center text-sm">
                          {typeof feature.starter === 'boolean' ? (
                            feature.starter ? (
                              <Check className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : (
                            feature.starter
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          {typeof feature.pro === 'boolean' ? (
                            feature.pro ? (
                              <Check className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : (
                            feature.pro
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? (
                              <Check className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : (
                            feature.enterprise
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>

        {/* FAQ Section */}
        <Card className="p-8 mt-8">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Can I upgrade or downgrade my plan?</h4>
              <p className="text-sm text-muted-foreground">
                Yes, you can change your plan at any time. Upgrades take effect immediately, 
                while downgrades apply at the end of your billing cycle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">What happens if I exceed my limits?</h4>
              <p className="text-sm text-muted-foreground">
                You'll receive a notification when you reach 80% of your limits. You can 
                either upgrade your plan or purchase additional credits for overage.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Do you offer refunds?</h4>
              <p className="text-sm text-muted-foreground">
                We offer a 14-day money-back guarantee for new subscribers. Contact our 
                support team if you're not satisfied with the service.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
