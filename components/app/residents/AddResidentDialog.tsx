'use client';

import { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
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

  // Validation errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    apartmentNumber?: string;
    residenceId?: string;
  }>({});

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
      }
    }

    // Phone validation (optional but if provided, should be valid)
    if (phoneNumber.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        newErrors.phoneNumber = 'Invalid phone number format';
      }
    }

    // Apartment number validation
    if (!apartmentNumber.trim()) {
      newErrors.apartmentNumber = 'Apartment number is required';
    }

    // Residence validation
    if (!residenceId) {
      newErrors.residenceId = 'Residence is required';
    }

    setErrors(newErrors);
    console.log('[AddResidentDialog] Validation errors:', newErrors);

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
          residence_id: result.resident.residence_id,
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
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors({ ...errors, email: undefined });
                  }
                }}
                placeholder="Enter email address"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive" role="alert">
                  {errors.email}
                </p>
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
                Apartment Number <span className="text-destructive">*</span>
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
                placeholder="Enter apartment/unit number"
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
            <Button type="submit" disabled={submitting || loading}>
              {submitting ? 'Adding...' : 'Add Resident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
