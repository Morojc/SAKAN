'use client';

import { useEffect, useState } from 'react';
import OnboardingWizard from './onboarding/OnboardingWizard';

interface OnboardingGuardProps {
  children: React.ReactNode;
  onboardingCompleted: boolean;
}

/**
 * Onboarding Guard Component
 * Shows onboarding wizard if user hasn't completed onboarding
 */
export default function OnboardingGuard({ children, onboardingCompleted }: OnboardingGuardProps) {
  const [showOnboarding, setShowOnboarding] = useState(!onboardingCompleted);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setShowOnboarding(!onboardingCompleted);
  }, [onboardingCompleted]);

  if (!mounted) {
    return <>{children}</>;
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setShowOnboarding(false);
        }}
      />
    );
  }

  return <>{children}</>;
}

