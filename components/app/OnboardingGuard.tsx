'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingWizard from './onboarding/OnboardingWizard';

interface OnboardingGuardProps {
  children: React.ReactNode;
  onboardingCompleted: boolean;
}

/**
 * Onboarding Guard Component
 * Shows onboarding wizard if user hasn't completed onboarding
 * Displays "Configurez votre résidence en quelques étapes simples" for syndics without residence
 */
export default function OnboardingGuard({ children, onboardingCompleted }: OnboardingGuardProps) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(!onboardingCompleted);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setShowOnboarding(!onboardingCompleted);
  }, [onboardingCompleted]);

  const handleComplete = () => {
    setShowOnboarding(false);
    // Force a full page refresh to re-evaluate onboarding status
    router.refresh();
    // Also navigate to dashboard to ensure we're on the right page
    setTimeout(() => {
      router.push('/app');
    }, 100);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={handleComplete}
      />
    );
  }

  return <>{children}</>;
}

