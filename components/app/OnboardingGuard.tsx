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

  const handleComplete = async () => {
    setShowOnboarding(false);
    // Force a full page refresh to re-evaluate onboarding status
    // Use window.location.reload() to ensure a complete refresh and remount of all components
    // This ensures the server re-renders with updated onboarding status and dashboard content loads
    window.location.reload();
  };

  const handleCancel = () => {
    setShowOnboarding(false);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  }

  return <>{children}</>;
}

