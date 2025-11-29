'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResidentWithFees } from './ResidentsContent';
import { createResident, getResidences } from '@/app/app/residents/actions';
import toast from 'react-hot-toast';

interface AddResidentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (resident: ResidentWithFees) => void;
  currentUserRole?: string;
  currentUserResidenceId?: number | null;
}

/**
 * Add Resident Dialog Component
 * Form for adding new residents with validation
 */
export default function AddResidentDialog({
  open,
  onClose,
  onSuccess,
  currentUserRole,
  currentUserResidenceId,
}: AddResidentDialogProps) {
  console.log('[AddResidentDialog] Dialog render - open:', open);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [residences, setResidences] = useState<{ id: number; name: string; address: string; city: string }[]>([]);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [residenceId, setResidenceId] = useState<string>('');
  const [role, setRole] = useState<'resident' | 'guard'>('resident');

  // Email validation state
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [isSyndic, setIsSyndic] = useState(false);
  const [syndicError, setSyndicError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    apartmentNumber?: string;
    residenceId?: string;
  }>({});

  // Get current user email
  useEffect(() => {
    async function fetchCurrentUserEmail() {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        // Check if response is OK and is JSON
        if (!response.ok) {
          console.warn('[AddResidentDialog] Session fetch not OK:', response.status);
          return;
        }

        // Check content type to ensure it's JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('[AddResidentDialog] Response is not JSON, got:', contentType);
          return;
        }

        const data = await response.json();
        if (data?.user?.email) {
          setCurrentUserEmail(data.user.email.toLowerCase());
        }
      } catch (error: any) {
        // Handle JSON parse errors specifically
        if (error.message?.includes('JSON') || error.message?.includes('Unexpected token')) {
          console.warn('[AddResidentDialog] Received non-JSON response from auth session (likely redirect)');
        } else {
          console.error('[AddResidentDialog] Error fetching user email:', error);
        }
      }
    }
    fetchCurrentUserEmail();
  }, []);

  // Fetch residences when dialog opens
  useEffect(() => {
    if (open) {
      console.log('[AddResidentDialog] Dialog opened, fetching residences');
      fetchResidences();
      // Reset form
      resetForm();
      
      // Pre-fill residence if user is syndic and has a residence assigned
      if (currentUserRole === 'syndic' && currentUserResidenceId) {
        console.log('[AddResidentDialog] Pre-filling residence for syndic:', currentUserResidenceId);
        setResidenceId(currentUserResidenceId.toString());
      }
    }
  }, [open, currentUserRole, currentUserResidenceId]);

  // Debounced email check
  const checkEmailExists = useCallback(
    async (emailToCheck: string) => {
      if (!emailToCheck.trim()) {
        setEmailExists(false);
        setEmailChecking(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailToCheck.trim())) {
        setEmailExists(false);
        setEmailChecking(false);
        return;
      }

      // If email matches current user's email, still check if they're a syndic
      // (syndics cannot be added as residents even if it's the current user)

      setEmailChecking(true);
      try {
        const response = await fetch('/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToCheck.trim() }),
        });

        const data = await response.json();
        
        if (data.success) {
          setEmailExists(data.exists && !data.belongsToCurrentUser);
          setIsSyndic(data.isSyndic || false);
          setSyndicError(data.isSyndic ? (data.error || 'Cannot add a syndic as a resident. Syndics cannot be added to residences as residents.') : null);
        } else {
          setEmailExists(false);
          setIsSyndic(false);
          setSyndicError(null);
        }
      } catch (error) {
        console.error('[AddResidentDialog] Error checking email:', error);
        setEmailExists(false);
        setIsSyndic(false);
        setSyndicError(null);
      } finally {
        setEmailChecking(false);
      }
    },
    [currentUserEmail]
  );

  // Debounce email check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email.trim()) {
        checkEmailExists(email);
      } else {
        setEmailExists(false);
        setEmailChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [email, checkEmailExists]);

  async function fetchResidences() {
    setLoading(true);
    try {
      const result = await getResidences();
      if (result.success) {
        console.log('[AddResidentDialog] Residences fetched:', result.residences.length);
        setResidences(result.residences);
      } else {
        console.error('[AddResidentDialog] Error fetching residences:', result.error);
        toast.error(result.error || 'Failed to load residences');
      }
    } catch (error: any) {
      console.error('[AddResidentDialog] Error fetching residences:', error);
      toast.error(error.message || 'Failed to load residences');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setApartmentNumber('');
    setResidenceId('');
    setRole('resident');
    setErrors({});
    setEmailExists(false);
    setIsSyndic(false);
    setSyndicError(null);
    setEmailChecking(false);
  }

  function validateForm(): boolean {
    const newErrors: typeof errors = {};

    // Full name validation
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Invalid email format';
      } else if (isSyndic) {
        newErrors.email = syndicError || 'Cannot add a syndic as a resident. Syndics cannot be added to residences as residents.';
      } else if (emailExists) {
        newErrors.email = 'This email is already registered to another user. Please use a different email address.';
      }
    }

    // Phone validation (optional but if provided, should be valid)
    if (phoneNumber.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        newErrors.phoneNumber = 'Invalid phone number format';
      }
    }

    // Apartment number validation (only required for residents, not guards)
    if (role === 'resident' && !apartmentNumber.trim()) {
      newErrors.apartmentNumber = 'Apartment number is required for residents';
    }

    // Residence validation
    if (!residenceId) {
      newErrors.residenceId = 'Residence is required';
    }

    setErrors(newErrors);
    console.log('[AddResidentDialog] Validation errors:', newErrors);

    // Also check if email exists or is syndic (even if not in errors yet)
    if (emailExists || isSyndic) {
      return false;
    }

    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[AddResidentDialog] Submitting form');

    // Validate form
    if (!validateForm()) {
      console.log('[AddResidentDialog] Form validation failed');
      toast.error('Please fix the errors in the form');
      return;
    }

    setSubmitting(true);

    try {
      const result = await createResident({
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim() || undefined,
        apartment_number: apartmentNumber.trim(),
        residence_id: Number(residenceId),
        role,
      });

      if (result.success && result.resident) {
        console.log('[AddResidentDialog] Resident created:', result.resident);

        // Transform to ResidentWithFees format
        const newResident: ResidentWithFees = {
          id: result.resident.id,
          full_name: result.resident.full_name,
          apartment_number: result.resident.apartment_number,
          phone_number: result.resident.phone_number,
          role: result.resident.role,
          created_at: result.resident.created_at,
          residence_id: Number(residenceId),
          email: email.trim(),
          fees: [],
          outstandingFees: 0,
          feeCount: 0,
          unpaidFeeCount: 0,
          residences: result.resident.residences && Array.isArray(result.resident.residences) && result.resident.residences.length > 0 ? {
            id: result.resident.residences[0].id,
            name: result.resident.residences[0].name,
            address: result.resident.residences[0].address,
          } : null,
        };

        toast.success('Resident added successfully!');
        resetForm();
        onSuccess(newResident);
        onClose();
      } else {
        console.error('[AddResidentDialog] Error:', result.error);
        toast.error(result.error || 'Failed to create resident');
      }
    } catch (error: any) {
      console.error('[AddResidentDialog] Error creating resident:', error);
      toast.error(error.message || 'Failed to create resident');
    } finally {
      setSubmitting(false);
    }
  }

  console.log('[AddResidentDialog] Rendering Dialog with open:', open);
  
  const handleOpenChange = (isOpen: boolean) => {
    console.log('[AddResidentDialog] onOpenChange called with:', isOpen);
    if (!isOpen) {
      onClose();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Resident
          </DialogTitle>
          <DialogDescription>
            Fill in the information to add a new resident to the building.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Full Name */}
            <div className="grid gap-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) {
                    setErrors({ ...errors, fullName: undefined });
                  }
                }}
                placeholder="Enter full name"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                className={errors.fullName ? 'border-destructive' : ''}
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-sm text-destructive" role="alert">
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailExists(false); // Reset on change
                    setIsSyndic(false);
                    setSyndicError(null);
                    if (errors.email) {
                      setErrors({ ...errors, email: undefined });
                    }
                  }}
                  onBlur={() => {
                    if (email.trim()) {
                      checkEmailExists(email);
                    }
                  }}
                  placeholder="Enter email address"
                  aria-invalid={!!errors.email || emailExists || isSyndic}
                  aria-describedby={errors.email || emailExists || isSyndic ? 'email-error' : undefined}
                  className={`${errors.email || emailExists || isSyndic ? 'border-destructive' : ''} ${emailChecking ? 'pr-10' : ''}`}
                />
                {emailChecking && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {(errors.email || emailExists || isSyndic) && (
                <div className="flex items-start gap-2 text-sm text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p id="email-error">
                    {errors.email || syndicError || 'This email is already registered to another user. Please use a different email address.'}
                  </p>
                </div>
              )}
            </div>

            {/* Phone Number */}
            <div className="grid gap-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (errors.phoneNumber) {
                    setErrors({ ...errors, phoneNumber: undefined });
                  }
                }}
                placeholder="Enter phone number (optional)"
                aria-invalid={!!errors.phoneNumber}
                aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : undefined}
                className={errors.phoneNumber ? 'border-destructive' : ''}
              />
              {errors.phoneNumber && (
                <p id="phoneNumber-error" className="text-sm text-destructive" role="alert">
                  {errors.phoneNumber}
                </p>
              )}
            </div>

            {/* Apartment Number */}
            <div className="grid gap-2">
              <Label htmlFor="apartmentNumber">
                Apartment Number {role === 'resident' && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="apartmentNumber"
                value={apartmentNumber}
                onChange={(e) => {
                  setApartmentNumber(e.target.value);
                  if (errors.apartmentNumber) {
                    setErrors({ ...errors, apartmentNumber: undefined });
                  }
                }}
                placeholder={role === 'guard' ? 'Not applicable for guards' : 'Enter apartment/unit number'}
                disabled={role === 'guard'}
                aria-invalid={!!errors.apartmentNumber}
                aria-describedby={errors.apartmentNumber ? 'apartmentNumber-error' : undefined}
                className={errors.apartmentNumber ? 'border-destructive' : ''}
              />
              {errors.apartmentNumber && (
                <p id="apartmentNumber-error" className="text-sm text-destructive" role="alert">
                  {errors.apartmentNumber}
                </p>
              )}
            </div>

            {/* Residence */}
            <div className="grid gap-2">
              <Label htmlFor="residenceId">
                Residence <span className="text-destructive">*</span>
              </Label>
              {currentUserRole === 'syndic' && currentUserResidenceId ? (
                // If user is syndic, show read-only input or disabled select
                <div className="relative">
                  <Input
                    value={residences.find(r => r.id === currentUserResidenceId)?.name || 'Your Residence'}
                    disabled
                    className="bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200"
                  />
                  <input type="hidden" value={currentUserResidenceId} />
                </div>
              ) : (
                <Select
                  value={residenceId}
                  onValueChange={(value: string) => {
                    setResidenceId(value);
                    if (errors.residenceId) {
                      setErrors({ ...errors, residenceId: undefined });
                    }
                  }}
                  disabled={loading}
                >
                  <SelectTrigger
                    id="residenceId"
                    aria-invalid={!!errors.residenceId}
                    aria-describedby={errors.residenceId ? 'residenceId-error' : undefined}
                    className={errors.residenceId ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder={loading ? 'Loading residences...' : 'Select residence'} />
                  </SelectTrigger>
                  <SelectContent>
                    {residences.map((residence) => (
                      <SelectItem key={residence.id} value={residence.id.toString()}>
                        {residence.name} - {residence.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.residenceId && (
                <p id="residenceId-error" className="text-sm text-destructive" role="alert">
                  {errors.residenceId}
                </p>
              )}
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select value={role} onValueChange={(value: 'resident' | 'guard') => setRole(value)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="guard">Guard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || loading || emailExists || isSyndic || emailChecking} 
              className={`w-1/2 shadow-lg transition-all font-semibold ${'bg-gray-900 hover:bg-gray-800 text-white shadow-gray-900/10' }`}
            >
              {submitting ? 'Adding...' : 'Add Resident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
