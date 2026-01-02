'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

interface ResidenceRegistrationFormProps {
  code: string;
}

export default function ResidenceRegistrationForm({ code }: ResidenceRegistrationFormProps) {
  const router = useRouter();
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [residence, setResidence] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (code) {
      validateCode();
    } else {
      setError('Invalid registration code');
      setLoading(false);
    }
  }, [code]);

  const validateCode = async () => {
    if (!code) {
      setError('Invalid registration code');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/register/validate/${code}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid registration code');
      } else {
        setResidence(data.residence);
      }
    } catch (err: any) {
      setError('Failed to validate code');
    } finally {
      setLoading(false);
    }
  };

  const validateBeforeSubmit = async (): Promise<boolean> => {
    if (!residence || !email || !phoneNumber || !apartmentNumber) {
      return false;
    }

    setValidating(true);
    setValidationErrors([]);

    try {
      const response = await fetch('/api/register/validate-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residenceId: residence.id,
          email,
          phoneNumber,
          apartmentNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          setValidationErrors(data.errors);
        } else {
          setValidationErrors([data.error || 'Validation failed']);
        }
        return false;
      }

      return true;
    } catch (err) {
      setValidationErrors(['Failed to validate. Please try again.']);
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate for duplicates before submitting
    const isValid = await validateBeforeSubmit();
    if (!isValid) {
      return;
    }

    setSubmitting(true);

    try {
      // Submit registration
      const response = await fetch('/api/register/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residenceId: residence.id,
          fullName,
          email,
          phoneNumber,
          apartmentNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle multiple errors
        if (data.errors && Array.isArray(data.errors)) {
          setValidationErrors(data.errors);
          data.errors.forEach((err: string) => {
            toast.error(err, { duration: 5000 });
          });
        } else {
          setValidationErrors([data.error || 'Failed to submit registration']);
          toast.error(data.error || 'Failed to submit registration', { duration: 5000 });
        }
      } else {
        setValidationErrors([]);
        setSuccess(true);
        toast.success('Registration submitted successfully!');
        // Clear form fields
        setFullName('');
        setEmail('');
        setPhoneNumber('');
        setApartmentNumber('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Code</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
            <p className="text-gray-600 mb-4">
              Your registration request has been submitted successfully. The syndic will review your request and send you an email with further instructions.
            </p>
            <p className="text-sm text-gray-500">
              Typically reviewed within 24-48 hours
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Building2 className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {residence.name}
          </h1>
          <p className="text-gray-600">{residence.address}</p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Resident Registration</CardTitle>
            <CardDescription>
              Please fill out the form below to register as a new resident
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setValidationErrors([]);
                  }}
                  required
                  placeholder="john@example.com"
                  className={validationErrors.some(e => e.toLowerCase().includes('email')) ? 'border-red-500' : ''}
                />
                {validationErrors.some(e => e.toLowerCase().includes('email')) && (
                  <p className="text-sm text-red-600 mt-1">
                    {validationErrors.find(e => e.toLowerCase().includes('email'))}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setValidationErrors([]);
                  }}
                  required
                  placeholder="+212 6 12 34 56 78"
                  className={validationErrors.some(e => e.toLowerCase().includes('phone')) ? 'border-red-500' : ''}
                />
                {validationErrors.some(e => e.toLowerCase().includes('phone')) && (
                  <p className="text-sm text-red-600 mt-1">
                    {validationErrors.find(e => e.toLowerCase().includes('phone'))}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="apartmentNumber">Apartment Number *</Label>
                <Input
                  id="apartmentNumber"
                  value={apartmentNumber}
                  onChange={(e) => {
                    setApartmentNumber(e.target.value);
                    setValidationErrors([]);
                  }}
                  required
                  placeholder="A101"
                  className={validationErrors.some(e => e.toLowerCase().includes('apartment')) ? 'border-red-500' : ''}
                />
                {validationErrors.some(e => e.toLowerCase().includes('apartment')) && (
                  <p className="text-sm text-red-600 mt-1">
                    {validationErrors.find(e => e.toLowerCase().includes('apartment'))}
                  </p>
                )}
              </div>


              {/* Validation Errors Summary */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">
                    Please fix the following issues:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Privacy Notice:</strong> Your information will be shared with the residence syndic for verification purposes only.
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || validating || validationErrors.length > 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Registration'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by SAKAN</p>
        </div>
      </div>
    </div>
  );
}

