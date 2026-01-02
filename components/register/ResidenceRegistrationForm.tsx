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

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('File must be JPG, PNG, or PDF');
        return;
      }

      setIdDocument(file);
    }
  };

  const uploadDocument = async (): Promise<string | null> => {
    if (!idDocument || !residence) return null;

    setUploading(true);
    try {
      const timestamp = Date.now();
      const fileName = `${residence.id}/${timestamp}_${idDocument.name}`;

      const { data, error } = await supabase.storage
        .from('resident-id-documents')
        .upload(fileName, idDocument, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload document');
        return null;
      }

      // Get public URL (or use signed URL for private bucket)
      const { data: { publicUrl } } = supabase.storage
        .from('resident-id-documents')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (err) {
      console.error('Upload exception:', err);
      toast.error('Failed to upload document');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idDocument) {
      toast.error('Please upload your ID document');
      return;
    }

    setSubmitting(true);

    try {
      // Upload document first
      const documentUrl = await uploadDocument();
      if (!documentUrl) {
        setSubmitting(false);
        return;
      }

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
          idNumber,
          idDocumentUrl: documentUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to submit registration');
      } else {
        setSuccess(true);
        toast.success('Registration submitted successfully!');
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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="+212 6 12 34 56 78"
                />
              </div>

              <div>
                <Label htmlFor="apartmentNumber">Apartment Number *</Label>
                <Input
                  id="apartmentNumber"
                  value={apartmentNumber}
                  onChange={(e) => setApartmentNumber(e.target.value)}
                  required
                  placeholder="A101"
                />
              </div>

              <div>
                <Label htmlFor="idNumber">ID Card / Passport Number *</Label>
                <Input
                  id="idNumber"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  required
                  placeholder="AB123456"
                />
              </div>

              <div>
                <Label htmlFor="idDocument">ID Document (PDF, JPG, or PNG) *</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="idDocument"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    required
                  />
                  {idDocument && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      {idDocument.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum file size: 5MB
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Privacy Notice:</strong> Your information will be shared with the residence syndic for verification purposes only.
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {submitting || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {uploading ? 'Uploading...' : 'Submitting...'}
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

