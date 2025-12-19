/**
 * Multi-step wizard component
 * Reusable wizard for multi-step forms like campaign builder
 */

import { useState, useCallback, ReactNode, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  description?: string;
  isOptional?: boolean;
  validate?: () => boolean | Promise<boolean>;
}

interface WizardContextValue {
  currentStep: number;
  steps: WizardStep[];
  goToStep: (step: number) => void;
  nextStep: () => Promise<void>;
  prevStep: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isStepComplete: (stepIndex: number) => boolean;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

interface WizardProps {
  steps: WizardStep[];
  initialStep?: number;
  onComplete: () => void | Promise<void>;
  onStepChange?: (step: number) => void;
  children: ReactNode;
  className?: string;
}

export function Wizard({
  steps,
  initialStep = 0,
  onComplete,
  onStepChange,
  children,
  className,
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isValidating, setIsValidating] = useState(false);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
      onStepChange?.(step);
    }
  }, [steps.length, onStepChange]);

  const nextStep = useCallback(async () => {
    const step = steps[currentStep];
    
    if (step.validate) {
      setIsValidating(true);
      try {
        const isValid = await step.validate();
        if (!isValid) {
          setIsValidating(false);
          return;
        }
      } catch {
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    setCompletedSteps(prev => new Set(prev).add(currentStep));

    if (isLastStep) {
      await onComplete();
    } else {
      goToStep(currentStep + 1);
    }
  }, [currentStep, steps, isLastStep, onComplete, goToStep]);

  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      goToStep(currentStep - 1);
    }
  }, [isFirstStep, currentStep, goToStep]);

  const isStepComplete = useCallback((stepIndex: number) => {
    return completedSteps.has(stepIndex);
  }, [completedSteps]);

  const value: WizardContextValue = {
    currentStep,
    steps,
    goToStep,
    nextStep,
    prevStep,
    isFirstStep,
    isLastStep,
    isStepComplete,
  };

  return (
    <WizardContext.Provider value={value}>
      <div className={cn('space-y-8', className)}>
        {children}
      </div>
    </WizardContext.Provider>
  );
}

/**
 * Step indicator component
 */
interface WizardStepsProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function WizardSteps({ className, variant = 'default' }: WizardStepsProps) {
  const { currentStep, steps, goToStep, isStepComplete } = useWizard();

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => index < currentStep && goToStep(index)}
            disabled={index > currentStep}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              index === currentStep
                ? 'w-8 bg-primary'
                : isStepComplete(index)
                ? 'bg-primary/50'
                : 'bg-muted'
            )}
            aria-label={`Step ${index + 1}: ${step.title}`}
            aria-current={index === currentStep ? 'step' : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <button
              onClick={() => index < currentStep && goToStep(index)}
              disabled={index > currentStep}
              className="flex items-center gap-2 group"
              aria-current={index === currentStep ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                  index === currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isStepComplete(index)
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'border-muted text-muted-foreground'
                )}
              >
                {isStepComplete(index) ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </span>
              {variant === 'default' && (
                <span className="hidden md:block">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      index === currentStep
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="text-xs text-muted-foreground block">
                      {step.description}
                    </span>
                  )}
                </span>
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'hidden md:block w-12 lg:w-24 h-0.5 mx-2',
                  isStepComplete(index) ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Step content wrapper
 */
interface WizardContentProps {
  children: ReactNode[];
  className?: string;
}

export function WizardContent({ children, className }: WizardContentProps) {
  const { currentStep } = useWizard();
  
  return (
    <div className={cn('min-h-[300px]', className)}>
      {children[currentStep]}
    </div>
  );
}

/**
 * Navigation buttons for wizard
 */
interface WizardNavigationProps {
  className?: string;
  nextLabel?: string;
  prevLabel?: string;
  completeLabel?: string;
  isLoading?: boolean;
}

export function WizardNavigation({
  className,
  nextLabel = 'Next',
  prevLabel = 'Back',
  completeLabel = 'Complete',
  isLoading = false,
}: WizardNavigationProps) {
  const { nextStep, prevStep, isFirstStep, isLastStep } = useWizard();

  return (
    <div className={cn('flex justify-between', className)}>
      <Button
        variant="outline"
        onClick={prevStep}
        disabled={isFirstStep || isLoading}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {prevLabel}
      </Button>
      <Button onClick={nextStep} disabled={isLoading}>
        {isLoading ? (
          'Processing...'
        ) : isLastStep ? (
          completeLabel
        ) : (
          <>
            {nextLabel}
            <ChevronRight className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}
