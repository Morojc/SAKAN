'use client';

import { useState } from 'react';
import { Building2, MapPin, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { createResidence } from '@/app/app/onboarding/actions';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type OnboardingStep = 'residence-name' | 'residence-details' | 'complete';

/**
 * Onboarding Wizard Component
 * Guides new syndic users through setting up their first residence
 */
export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('residence-name');
  const [loading, setLoading] = useState(false);

  // Form state
  const [residenceName, setResidenceName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [bankAccountRIB, setBankAccountRIB] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<{
    residenceName?: string;
    address?: string;
    city?: string;
  }>({});

  const steps = [
    { id: 'residence-name', label: 'Nom de résidence', icon: Building2 },
    { id: 'residence-details', label: 'Détails', icon: MapPin },
    { id: 'complete', label: 'Terminé', icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const validateStep1 = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!residenceName.trim()) {
      newErrors.residenceName = 'Le nom de la résidence est requis';
    } else if (residenceName.trim().length < 2) {
      newErrors.residenceName = 'Le nom doit contenir au moins 2 caractères';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!address.trim()) {
      newErrors.address = 'L\'adresse est requise';
    } else if (address.trim().length < 5) {
      newErrors.address = 'L\'adresse doit contenir au moins 5 caractères';
    }

    if (!city.trim()) {
      newErrors.city = 'La ville est requise';
    } else if (city.trim().length < 2) {
      newErrors.city = 'La ville doit contenir au moins 2 caractères';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 'residence-name') {
      if (validateStep1()) {
        setCurrentStep('residence-details');
      }
    } else if (currentStep === 'residence-details') {
      if (validateStep2()) {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'residence-details') {
      setCurrentStep('residence-name');
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) {
      return;
    }

    setLoading(true);
    try {
      const result = await createResidence({
        name: residenceName.trim(),
        address: address.trim(),
        city: city.trim(),
        bank_account_rib: bankAccountRIB.trim() || undefined,
      });

      if (result.success) {
        toast.success('Résidence créée avec succès!');
        setCurrentStep('complete');
        // Wait a moment to show success, then complete onboarding
        setTimeout(() => {
          onComplete();
          router.refresh();
        }, 1500);
      } else {
        toast.error(result.error || 'Erreur lors de la création de la résidence');
      }
    } catch (error: any) {
      console.error('[OnboardingWizard] Error creating residence:', error);
      toast.error(error.message || 'Erreur lors de la création de la résidence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 shadow-lg">
        <CardHeader className="space-y-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl">Bienvenue dans SAKAN!</CardTitle>
            <CardDescription>
              Configurez votre résidence en quelques étapes simples
            </CardDescription>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Étape {currentStepIndex + 1} sur {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between pt-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCompleted
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted bg-muted text-muted-foreground'
                    }`}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <span
                    className={`mt-2 text-xs text-center ${
                      isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Residence Name */}
          {currentStep === 'residence-name' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="residenceName">
                  Nom de la résidence <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="residenceName"
                  value={residenceName}
                  onChange={(e) => {
                    setResidenceName(e.target.value);
                    if (errors.residenceName) {
                      setErrors({ ...errors, residenceName: undefined });
                    }
                  }}
                  placeholder="Ex: Résidence Les Jardins"
                  className={errors.residenceName ? 'border-destructive' : ''}
                  autoFocus
                />
                {errors.residenceName && (
                  <p className="text-sm text-destructive">{errors.residenceName}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Residence Details */}
          {currentStep === 'residence-details' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">
                  Adresse complète <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (errors.address) {
                      setErrors({ ...errors, address: undefined });
                    }
                  }}
                  placeholder="Ex: 123 Rue Example, Quartier..."
                  className={errors.address ? 'border-destructive' : ''}
                  autoFocus
                />
                {errors.address && (
                  <p className="text-sm text-destructive">{errors.address}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">
                  Ville <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) {
                      setErrors({ ...errors, city: undefined });
                    }
                  }}
                  placeholder="Ex: Casablanca"
                  className={errors.city ? 'border-destructive' : ''}
                />
                {errors.city && (
                  <p className="text-sm text-destructive">{errors.city}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccountRIB">
                  RIB du compte bancaire (optionnel)
                </Label>
                <Input
                  id="bankAccountRIB"
                  value={bankAccountRIB}
                  onChange={(e) => setBankAccountRIB(e.target.value)}
                  placeholder="Ex: MA64 1234 5678 9012 3456 7890 123"
                />
                <p className="text-xs text-muted-foreground">
                  Vous pourrez ajouter ou modifier ce RIB plus tard
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Configuration terminée!</h3>
                <p className="text-muted-foreground">
                  Votre résidence "{residenceName}" a été créée avec succès.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep !== 'complete' && (
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 'residence-name' || loading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Précédent
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
              >
                {currentStep === 'residence-details' ? (
                  <>
                    {loading ? 'Création...' : 'Créer la résidence'}
                    {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                  </>
                ) : (
                  <>
                    Suivant
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

