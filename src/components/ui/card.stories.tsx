import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './card';
import { ShoppingBag } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="p-6 w-80">
      <h3 className="text-lg font-semibold mb-2">Card Title</h3>
      <p className="text-muted-foreground">
        This is a basic card component with some content inside.
      </p>
    </Card>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <Card className="p-6 w-80">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <ShoppingBag className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Marketplace Pack</h3>
          <p className="text-sm text-muted-foreground">
            Discover templates and presets
          </p>
        </div>
      </div>
    </Card>
  ),
};

export const MarketplaceItem: Story = {
  render: () => (
    <Card className="overflow-hidden w-80 hover:border-primary/50 transition-all">
      <div className="w-full h-48 bg-gradient-card flex items-center justify-center">
        <ShoppingBag className="h-12 w-12 text-primary" />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">Creator Toolkit</h3>
          <Badge variant="secondary" className="shrink-0">
            template
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          Influencer toolkit with social media templates and caption generator
        </p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">1.2K downloads</span>
          <Button size="sm" className="bg-gradient-hero">
            Install Free
          </Button>
        </div>
      </div>
    </Card>
  ),
};

export const WithHover: Story = {
  render: () => (
    <Card className="p-6 w-80 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group">
      <div className="mb-4">
        <div className="p-3 bg-gradient-card rounded-lg inline-block group-hover:scale-110 transition-transform">
          <ShoppingBag className="h-6 w-6 text-primary" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">Interactive Card</h3>
      <p className="text-muted-foreground">
        Hover over this card to see the hover effects in action
      </p>
    </Card>
  ),
};
