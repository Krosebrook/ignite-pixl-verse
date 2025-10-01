import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Plus } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Premium: Story = {
  args: {
    variant: 'premium',
    children: 'Premium Button',
  },
};

export const WithIcon: Story = {
  args: {
    variant: 'premium',
    children: (
      <>
        <Plus className="h-4 w-4" />
        New Campaign
      </>
    ),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
};
