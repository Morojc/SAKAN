'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Loader2, AlertCircle, Info, RotateCcw } from 'lucide-react';
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
  const [_emailExists, setEmailExists] = useState(false);
  const [isSyndic, setIsSyndic] = useState(false);
  const [existingRole, setExistingRole] = useState<string | null>(null);
  const [syndicError, setSyndicError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAddingSelf, setIsAddingSelf] = useState(false);
  const [_currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string; phone_number: string | null } | null>(null);
  const [existsInOtherResidence, setExistsInOtherResidence] = useState(false);
  const [_existingProfileData, setExistingProfileData] = useState<{ full_name: string; phone_number: string | null } | null>(null);

  // Apartment validation state
  const [apartmentChecking, setApartmentChecking] = useState(false);
  const [apartmentTaken, setApartmentTaken] = useState(false);
  const [apartmentError, setApartmentError] = useState<string | null>(null);
  const [_apartmentReservedBy, setApartmentReservedBy] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    apartmentNumber?: string;
    residenceId?: string;
  }>({});

  // Get current user email and profile
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

  // Fetch current user profile when isAddingSelf becomes true
  const fetchCurrentUserProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/current-user-profile');
      if (!response.ok) {
        console.warn('[AddResidentDialog] Failed to fetch profile:', response.status);
        return;
      }

      // Check content type to ensure it's JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[AddResidentDialog] Response is not JSON, got:', contentType);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('[AddResidentDialog] Failed to parse JSON response:', jsonError);
        return;
      }

      if (data && data.success && data.profile) {
        const profile = data.profile;
        setCurrentUserProfile({
          full_name: profile.full_name || '',
          phone_number: profile.phone_number || null,
        });
        // Pre-populate form fields
        setFullName(profile.full_name || '');
        if (currentUserEmail) {
          setEmail(currentUserEmail);
        }
        if (profile.phone_number) {
          setPhoneNumber(profile.phone_number);
        }
      }
    } catch (error) {
      console.error('[AddResidentDialog] Error fetching user profile:', error);
    }
  }, [currentUserEmail]);

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
        // Always use currentUserResidenceId for syndics if residenceId is not set yet
        const residenceIdToSend = residenceId || currentUserResidenceId || null;
        console.log('[AddResidentDialog] Checking email with residence:', {
          email: emailToCheck.trim(),
          residenceId,
          currentUserResidenceId,
          residenceIdToSend,
          currentUserRole
        });
        
        // If user is a syndic and no residence ID is available, skip the check
        if (currentUserRole === 'syndic' && !residenceIdToSend) {
          console.warn('[AddResidentDialog] Syndic but no residence ID available yet');
          setEmailChecking(false);
          return;
        }

        const response = await fetch('/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: emailToCheck.trim(),
            residence_id: residenceIdToSend
          }),
        });

        // Check if response is OK
        if (!response.ok) {
          console.warn('[AddResidentDialog] Email check failed:', response.status);
          setEmailChecking(false);
          return;
        }

        // Check content type to ensure it's JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('[AddResidentDialog] Response is not JSON, got:', contentType);
          setEmailChecking(false);
          return;
        }

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('[AddResidentDialog] Failed to parse JSON response:', jsonError);
          setEmailChecking(false);
          return;
        }

        console.log('[AddResidentDialog] Full API response:', data);
        
        if (data && data.success) {
          // A resident can be added by different syndics in different residences
          // Only set emailExists to true if we can't use the email
          setEmailExists(data.exists && !data.canUse);
          setIsSyndic(data.isSyndic || false);
          setExistingRole(data.existingRole || null);
          
          // Use the API's isAddingSelf flag to determine if syndic is adding themselves
          if (data.isAddingSelf === true) {
            console.log('[AddResidentDialog] ✅ Syndic is adding themselves - showing informational message');
            setIsAddingSelf(true);
            setSyndicError(null); // Clear any errors - this is allowed
            setEmailExists(false); // Clear email exists flag since this is allowed
            // Set email from current user email
            if (currentUserEmail) {
              setEmail(currentUserEmail);
            }
            // Fetch current user profile to pre-populate name and phone
            fetchCurrentUserProfile();
          } else {
            console.log('[AddResidentDialog] Not adding self:', { isAddingSelf: data.isAddingSelf });
            setIsAddingSelf(false);
            
            // If user exists (any existing resident), extract existing data and only allow apartment number input
            if (data.exists && data.existingProfileData) {
              setExistsInOtherResidence(true); // Use this flag to disable fields (only apartment editable)
              setExistingProfileData(data.existingProfileData);
              // Pre-populate fields with existing data (read-only)
              setFullName(data.existingProfileData.full_name);
              if (data.existingProfileData.phone_number) {
                setPhoneNumber(data.existingProfileData.phone_number);
              }
              // Lock role to existing role
              if (data.existingRole) {
                setRole(data.existingRole as 'resident' | 'guard');
              }
            } else {
              setExistsInOtherResidence(false);
              setExistingProfileData(null);
            }
            
            // Only show error if we can't use the email
            // Since canUse is now always true for existing users, no error should be shown
            setSyndicError(data.error || null);
            if (data.canUse) {
              setEmailExists(false); // Clear email exists flag if we can use the email
            }
          }
        } else {
          setEmailExists(false);
          setIsSyndic(false);
          setExistingRole(null);
          setSyndicError(null);
          setIsAddingSelf(false);
          setExistsInOtherResidence(false);
          setExistingProfileData(null);
        }
      } catch (error) {
        console.error('[AddResidentDialog] Error checking email:', error);
        setEmailExists(false);
        setIsSyndic(false);
        setExistingRole(null);
        setSyndicError(null);
        setIsAddingSelf(false);
      } finally {
        setEmailChecking(false);
      }
    },
    [currentUserEmail, currentUserRole, currentUserResidenceId, residenceId]
  );

  // Debounce email check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email.trim()) {
        checkEmailExists(email);
      } else {
        setEmailExists(false);
        setEmailChecking(false);
        setExistingRole(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [email, checkEmailExists]);

  // Check apartment availability
  const checkApartmentAvailability = useCallback(
    async (apartmentToCheck: string) => {
      if (!apartmentToCheck.trim() || role === 'guard') {
        setApartmentTaken(false);
        setApartmentError(null);
        setApartmentReservedBy(null);
        setApartmentChecking(false);
        return;
      }

      const residenceIdToCheck = residenceId || currentUserResidenceId || null;
      
      if (!residenceIdToCheck) {
        setApartmentChecking(false);
        return;
      }

      setApartmentChecking(true);
      try {
        const response = await fetch('/api/check-apartment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            apartment_number: apartmentToCheck.trim(),
            residence_id: residenceIdToCheck
          }),
        });

        // Check if response is OK
        if (!response.ok) {
          console.warn('[AddResidentDialog] Apartment check failed:', response.status);
          setApartmentChecking(false);
          return;
        }

        // Check content type to ensure it's JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('[AddResidentDialog] Response is not JSON, got:', contentType);
          setApartmentChecking(false);
          return;
        }

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('[AddResidentDialog] Failed to parse JSON response:', jsonError);
          setApartmentChecking(false);
          return;
        }
        
        if (data && data.success) {
          if (data.available === false) {
            setApartmentTaken(true);
            setApartmentReservedBy(data.reservedBy || 'another resident');
            setApartmentError(data.message || `Apartment ${apartmentToCheck.trim()} is already reserved.`);
          } else {
            setApartmentTaken(false);
            setApartmentError(null);
            setApartmentReservedBy(null);
          }
        } else {
          setApartmentTaken(false);
          setApartmentError(null);
        }
      } catch (error) {
        console.error('[AddResidentDialog] Error checking apartment:', error);
        setApartmentTaken(false);
        setApartmentError(null);
      } finally {
        setApartmentChecking(false);
      }
    },
    [residenceId, currentUserResidenceId, role]
  );

  // Debounce apartment check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (apartmentNumber.trim() && role === 'resident') {
        checkApartmentAvailability(apartmentNumber);
      } else {
        setApartmentTaken(false);
        setApartmentError(null);
        setApartmentReservedBy(null);
        setApartmentChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [apartmentNumber, checkApartmentAvailability, role]);

  async function fetchResidences() {
    setLoading(true);
    try {
      const result = await getResidences();
      if (result.success) {
        console.log('[AddResidentDialog] Residences fetched:', result.residences.length);
        setResidences(result.residences);
      } else {
        console.error('[AddResidentDialog] Error fetching residences');
        toast.error('Failed to load residences');
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
    setExistingRole(null);
    setSyndicError(null);
    setEmailChecking(false);
    setIsAddingSelf(false);
    setApartmentTaken(false);
    setApartmentError(null);
    setApartmentReservedBy(null);
    setApartmentChecking(false);
    setCurrentUserProfile(null);
    setExistsInOtherResidence(false);
    setExistingProfileData(null);
  }

  function validateForm(): boolean {
    const newErrors: typeof errors = {};

    // Skip validation for fields that are disabled when user exists in another residence
    // When existsInOtherResidence is true, only apartment number can be updated
    if (!existsInOtherResidence && !isAddingSelf) {
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
        } else if (syndicError) {
          newErrors.email = syndicError;
        }
        // Note: We no longer block existing users - they can be added to different residences
        // The only restrictions are checked in the backend (duplicate apartment/residence)
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
    } else if (role === 'resident' && apartmentNumber.trim() === '0') {
      newErrors.apartmentNumber = 'Apartment number cannot be 0 for residents. Only guards can use apartment number 0.';
    } else if (role === 'resident' && apartmentTaken) {
      newErrors.apartmentNumber = apartmentError || 'This apartment number is already reserved. Please use a different apartment number.';
    }

    // Residence validation
    if (!residenceId) {
      newErrors.residenceId = 'Residence is required';
    }

    setErrors(newErrors);
    console.log('[AddResidentDialog] Validation errors:', newErrors);

    // Also check if email exists or has syndic error (even if not in errors yet)
    // Note: We no longer block existing users - they can be added to different residences
    if (syndicError) {
      return false;
    }

    // Also check if apartment is taken
    if (apartmentTaken) {
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
                  if (!isAddingSelf && !existsInOtherResidence) {
                    setFullName(e.target.value);
                    if (errors.fullName) {
                      setErrors({ ...errors, fullName: undefined });
                    }
                  }
                }}
                disabled={isAddingSelf || existsInOtherResidence}
                placeholder="Enter full name"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                className={errors.fullName ? 'border-destructive' : (isAddingSelf || existsInOtherResidence ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : '')}
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-sm text-destructive" role="alert">
                  {errors.fullName}
                </p>
              )}
              {(isAddingSelf || existsInOtherResidence) && (
                <p className="text-xs text-gray-500 mt-1">
                  {isAddingSelf ? 'Your name from your profile (cannot be changed)' : 'Name from existing profile (cannot be changed)'}
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
                    if (!isAddingSelf && !existsInOtherResidence) {
                      setEmail(e.target.value);
                      setEmailExists(false); // Reset on change
                      setIsSyndic(false);
                      setSyndicError(null);
                      setIsAddingSelf(false); // Reset self-adding state
                      if (errors.email) {
                        setErrors({ ...errors, email: undefined });
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!isAddingSelf && !existsInOtherResidence && email.trim()) {
                      checkEmailExists(email);
                    }
                  }}
                  disabled={isAddingSelf || existsInOtherResidence}
                  placeholder="Enter email address"
                  aria-invalid={!!errors.email || !!syndicError}
                  aria-describedby={errors.email || syndicError ? 'email-error' : undefined}
                  className={`${errors.email || syndicError ? 'border-destructive' : ''} ${emailChecking ? 'pr-10' : ''} ${(isAddingSelf || existsInOtherResidence) ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : ''}`}
                />
                {emailChecking && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {/* Show informational message when syndic is adding themselves */}
              {isAddingSelf && (
                <div className="mt-3 mb-2">
                  <div className="flex items-start gap-3 text-sm bg-blue-50 border border-blue-300 rounded-lg p-4" role="alert">
                    <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900 mb-2 text-base">You are adding yourself as a resident</p>
                      <p className="text-blue-800 leading-relaxed">
                        You are about to add yourself as a resident to your managed residence. Your profile information will remain unchanged, and only your apartment number and phone number (if provided) will be updated. No verification email will be sent since you are adding yourself.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetForm();
                      // Clear email field to trigger re-check
                      setEmail('');
                      if (currentUserRole === 'syndic' && currentUserResidenceId) {
                        setResidenceId(currentUserResidenceId.toString());
                      }
                    }}
                    className="mt-2 text-blue-700 border-blue-300 hover:bg-blue-100 hover:text-blue-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Reset Form
                  </Button>
                </div>
              )}
              {/* Show informational message when user exists (any existing resident) */}
              {existsInOtherResidence && !isAddingSelf && (
                <div className="mt-3 mb-2">
                  <div className="flex items-start gap-3 text-sm bg-amber-50 border border-amber-300 rounded-lg p-4" role="alert">
                    <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-amber-900 mb-2 text-base">Existing resident detected</p>
                      <p className="text-amber-800 leading-relaxed">
                        This email belongs to an existing resident in the database. Their profile information has been extracted and only the apartment number can be updated. Name, email, phone number, and role are preserved from their existing profile and cannot be changed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Show error messages */}
              {(errors.email || syndicError) && (
                <div className="flex items-start gap-2 text-sm text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p id="email-error">
                    {errors.email || syndicError}
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
                  if (!existsInOtherResidence) {
                    setPhoneNumber(e.target.value);
                    if (errors.phoneNumber) {
                      setErrors({ ...errors, phoneNumber: undefined });
                    }
                  }
                }}
                disabled={existsInOtherResidence}
                placeholder="Enter phone number (optional)"
                aria-invalid={!!errors.phoneNumber}
                aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : undefined}
                className={errors.phoneNumber ? 'border-destructive' : (existsInOtherResidence ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : '')}
              />
              {existsInOtherResidence && (
                <p className="text-xs text-gray-500 mt-1">Phone number from existing profile (cannot be changed)</p>
              )}
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
              <div className="relative">
                <Input
                  id="apartmentNumber"
                  value={apartmentNumber}
                  onChange={(e) => {
                    setApartmentNumber(e.target.value);
                    if (errors.apartmentNumber) {
                      setErrors({ ...errors, apartmentNumber: undefined });
                    }
                    // Clear apartment error when user types
                    if (apartmentError || apartmentTaken) {
                      setApartmentError(null);
                      setApartmentTaken(false);
                      setApartmentReservedBy(null);
                    }
                  }}
                  placeholder={role === 'guard' ? 'Not applicable for guards' : 'Enter apartment/unit number'}
                  disabled={role === 'guard'}
                  aria-invalid={!!errors.apartmentNumber || apartmentTaken}
                  aria-describedby={(errors.apartmentNumber || apartmentTaken) ? 'apartmentNumber-error' : undefined}
                  className={`${errors.apartmentNumber || apartmentTaken ? 'border-destructive' : ''} ${apartmentChecking ? 'pr-10' : ''}`}
                />
                {apartmentChecking && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {errors.apartmentNumber && (
                <p id="apartmentNumber-error" className="text-sm text-destructive" role="alert">
                  {errors.apartmentNumber}
                </p>
              )}
              {apartmentTaken && apartmentError && (
                <div className="flex items-start gap-2 text-sm text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p id="apartmentNumber-error">{apartmentError}</p>
                </div>
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
              {existsInOtherResidence && existingRole ? (
                // User exists in another residence - show existing role (read-only)
                <div className="space-y-2">
                  <Input
                    value={`${existingRole.charAt(0).toUpperCase() + existingRole.slice(1)} (cannot be changed)`}
                    disabled
                    className="bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200"
                  />
                  <p className="text-xs text-gray-500">Role from existing profile (cannot be changed)</p>
                </div>
              ) : isAddingSelf ? (
                // Syndic adding themselves - lock role to resident
                <div className="space-y-2">
                  <Input
                    value="Resident"
                    disabled
                    className="bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200"
                  />
                  <p className="text-xs text-gray-500">Your role will remain as Syndic, but you'll be added as a Resident in this residence.</p>
                </div>
              ) : isSyndic && !isAddingSelf ? (
                // Another syndic being added - show read-only role
                <div className="space-y-2">
                  <Input
                    value="Syndic (cannot be changed)"
                    disabled
                    className="bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200"
                  />
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3" role="alert">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold mb-1">Role: Syndic (cannot be changed)</p>
                      <p>This user already has a syndic role. Cannot be changed but considered as a resident.</p>
                    </div>
                  </div>
                </div>
              ) : existingRole === 'resident' ? (
                // User already has resident role - lock it to resident
                <div className="space-y-2">
                  <Input
                    value="Resident (cannot be changed)"
                    disabled
                    className="bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200"
                  />
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3" role="alert">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold mb-1">Role: Resident (cannot be changed)</p>
                      <p>This user already has a resident role. Cannot be changed. and considered as a resident in this residence.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Select value={role} onValueChange={(value: 'resident' | 'guard') => setRole(value)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resident">Resident</SelectItem>
                    <SelectItem value="guard">Guard</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || loading || !!syndicError || emailChecking || apartmentTaken || apartmentChecking} 
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
