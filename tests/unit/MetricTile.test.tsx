import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricTile } from '@/components/ui/metric-tile';
import { TrendingUp, Users } from 'lucide-react';

describe('MetricTile Component', () => {
  it('renders with all required props', () => {
    render(
      <MetricTile
        label="Total Users"
        value="1,234"
        icon={Users}
        trend={{ value: 12, isPositive: true }}
      />
    );

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('renders positive trend correctly', () => {
    render(
      <MetricTile
        label="Revenue"
        value="$50K"
        icon={TrendingUp}
        trend={{ value: 25, isPositive: true }}
      />
    );

    const trendText = screen.getByText('+25%');
    expect(trendText).toBeInTheDocument();
    expect(trendText).toHaveClass('text-accent');
  });

  it('renders negative trend correctly', () => {
    render(
      <MetricTile
        label="Bounce Rate"
        value="23%"
        icon={TrendingUp}
        trend={{ value: 5, isPositive: false }}
      />
    );

    const trendText = screen.getByText('-5%');
    expect(trendText).toBeInTheDocument();
    expect(trendText).toHaveClass('text-destructive');
  });

  it('renders without trend when not provided', () => {
    render(
      <MetricTile
        label="New Metric"
        value="999"
        icon={Users}
      />
    );

    expect(screen.getByText('New Metric')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <MetricTile
        label="Custom"
        value="100"
        icon={Users}
        className="custom-class"
      />
    );

    const metricTile = container.firstChild as HTMLElement;
    expect(metricTile).toHaveClass('custom-class');
  });

  it('displays icon correctly', () => {
    const { container } = render(
      <MetricTile
        label="With Icon"
        value="500"
        icon={Users}
      />
    );

    // Icon should be rendered (lucide-react icons render as SVG)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('formats large numbers in value', () => {
    render(
      <MetricTile
        label="Big Number"
        value="1,000,000"
        icon={TrendingUp}
      />
    );

    expect(screen.getByText('1,000,000')).toBeInTheDocument();
  });

  it('applies glassmorphism card styles', () => {
    const { container } = render(
      <MetricTile
        label="Styled"
        value="123"
        icon={Users}
      />
    );

    const card = container.querySelector('.bg-card\\/50');
    expect(card).toBeInTheDocument();
  });
});
