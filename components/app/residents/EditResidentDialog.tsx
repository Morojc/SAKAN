'use client';

import { useState, useEffect } from 'react';
import { Pencil, Info } from 'lucide-react';
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
import { updateResident, getResidences } from '@/app/app/residents/actions';
import toast from 'react-hot-toast';

interface EditResidentDialogProps {
  open: boolean;
  resident: ResidentWithFees | null;
  onClose: () => void;
  onSuccess: (resident: ResidentWithFees) => void;
}

/**
 * Edit Resident Dialog Component
 * Form for editing existing residents with validation
 */
export default function EditResidentDialog({
  open,
  resident,
  onClose,
  onSuccess,
}: EditResidentDialogProps) {
  console.log('[EditResidentDialog] Dialog', open ? 'opened' : 'closed', 'for resident:', resident?.id);

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
  const [originalRole, setOriginalRole] = useState<string>(''); // Store original role to preserve syndic
  const [existsInOtherResidence, setExistsInOtherResidence] = useState(false); // Check if resident exists in other residences
  const [checkingOtherResidences, setCheckingOtherResidences] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    apartmentNumber?: string;
    residenceId?: string;
  }>({});

  // Check if resident exists in other residences
  async function checkOtherResidences(residentId: string, currentResidenceId: number) {
    setCheckingOtherResidences(true);
    try {
      const response = await fetch('/api/check-resident-other-residences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resident_id: residentId, residence_id: currentResidenceId }),
      });

      if (!response.ok) {
        console.error('[EditResidentDialog] Error checking other residences:', response.statusText);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[EditResidentDialog] Invalid response type:', contentType);
        return;
      }

      const data = await response.json();
      if (data.success && data.existsInOtherResidences) {
        setExistsInOtherResidence(true);
        console.log('[EditResidentDialog] Resident exists in other residences - only apartment number can be edited');
      } else {
        setExistsInOtherResidence(false);
      }
    } catch (error) {
      console.error('[EditResidentDialog] Error checking other residences:', error);
    } finally {
      setCheckingOtherResidences(false);
    }
  }

  // Load resident data when dialog opens
  useEffect(() => {
    if (open && resident) {
      console.log('[EditResidentDialog] Loading resident data:', resident);
      setFullName(resident.full_name);
      setEmail(resident.email || '');
      setPhoneNumber(resident.phone_number || '');
      setApartmentNumber(resident.apartment_number || '');
      setResidenceId(resident.residence_id?.toString() || '');
      // Store original role to preserve syndic role
      setOriginalRole(resident.role);
      // Only set role for non-syndics (syndics will keep their role)
      if (resident.role !== 'syndic') {
        setRole(resident.role as 'resident' | 'guard');
      }
      setErrors({});
      setExistsInOtherResidence(false);
      
      // Check if resident exists in other residences
      if (resident.id && resident.residence_id) {
        checkOtherResidences(resident.id, resident.residence_id);
      }
      
      fetchResidences();
    }
  }, [open, resident]);

  async function fetchResidences() {
    setLoading(true);
    try {
      const result = await getResidences();
      if (result.success) {
        console.log('[EditResidentDialog] Residences fetched:', result.residences.length);
        setResidences(result.residences);
      } else {
        console.error('[EditResidentDialog] Error fetching residences:', result.error);
        toast.error(result.error || 'Failed to load residences');
      }
    } catch (error: any) {
      console.error('[EditResidentDialog] Error fetching residences:', error);
      toast.error(error.message || 'Failed to load residences');
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: typeof errors = {};

    // Skip validation for disabled fields when resident exists in other residences
    if (!existsInOtherResidence) {
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
    }

    // Apartment number validation (always required)
    if (!apartmentNumber.trim()) {
      newErrors.apartmentNumber = 'Apartment number is required';
    } else if (originalRole !== 'syndic' && originalRole !== 'guard' && apartmentNumber.trim() === '0') {
      newErrors.apartmentNumber = 'Apartment number cannot be 0 for residents. Only guards can use apartment number 0.';
    }

    // Residence validation
    if (!residenceId) {
      newErrors.residenceId = 'Residence is required';
    }

    setErrors(newErrors);
    console.log('[EditResidentDialog] Validation errors:', newErrors);

    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[EditResidentDialog] Submitting form');

    if (!resident) {
      toast.error('No resident selected');
      return;
    }

    // Validate form
    if (!validateForm()) {
      console.log('[EditResidentDialog] Form validation failed');
      toast.error('Please fix the errors in the form');
      return;
    }

    setSubmitting(true);

    try {
      // If original role was syndic, preserve it; otherwise use the form role
      const roleToUpdate = originalRole === 'syndic' ? 'syndic' : role;
      
      const result = await updateResident({
        id: resident.id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim() || undefined,
        apartment_number: apartmentNumber.trim(),
        residence_id: Number(residenceId),
        role: roleToUpdate as 'syndic' | 'resident' | 'guard',
      });

      if (result.success && result.resident) {
        console.log('[EditResidentDialog] Resident updated:', result.resident);

        // Transform to ResidentWithFees format
        const updatedResident: ResidentWithFees = {
          ...resident,
          full_name: result.resident.full_name,
          apartment_number: result.resident.apartment_number,
          phone_number: result.resident.phone_number,
          role: result.resident.role,
          residence_id: Number(residenceId),
          email: email.trim(),
          residences: Array.isArray(result.resident.residences) && result.resident.residences.length > 0 ? {
            id: result.resident.residences[0].id,
            name: result.resident.residences[0].name,
            address: result.resident.residences[0].address,
          } : null,
        };

        toast.success('Resident updated successfully!');
        onSuccess(updatedResident);
        onClose();
      } else {
        console.error('[EditResidentDialog] Error:', result.error);
        toast.error(result.error || 'Failed to update resident');
      }
    } catch (error: any) {
      console.error('[EditResidentDialog] Error updating resident:', error);
      toast.error(error.message || 'Failed to update resident');
    } finally {
      setSubmitting(false);
    }
  }

  if (!resident) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Resident
          </DialogTitle>
          <DialogDescription>
            Update the resident information below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Informational message when resident exists in other residences */}
            {existsInOtherResidence && (
              <div className="mt-3 mb-2">
                <div className="flex items-start gap-3 text-sm bg-amber-50 border border-amber-300 rounded-lg p-4" role="alert">
                  <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 mb-2 text-base">Existing resident detected</p>
                    <p className="text-amber-800 leading-relaxed">
                      This resident exists in other residences. Their profile information has been extracted and only the apartment number can be updated. Name, email, phone number, and role are preserved from their existing profile and cannot be changed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Full Name */}
            <div className="grid gap-2">
              <Label htmlFor="edit-fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-fullName"
                value={fullName}
                onChange={(e) => {
                  if (!existsInOtherResidence) {
                    setFullName(e.target.value);
                    if (errors.fullName) {
                      setErrors({ ...errors, fullName: undefined });
                    }
                  }
                }}
                disabled={existsInOtherResidence}
                placeholder="Enter full name"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'edit-fullName-error' : undefined}
                className={errors.fullName ? 'border-destructive' : (existsInOtherResidence ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : '')}
              />
              {errors.fullName && (
                <p id="edit-fullName-error" className="text-sm text-destructive" role="alert">
                  {errors.fullName}
                </p>
              )}
              {existsInOtherResidence && (
                <p className="text-xs text-gray-500 mt-1">
                  Name from existing profile (cannot be changed)
                </p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="edit-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => {
                  if (!existsInOtherResidence) {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors({ ...errors, email: undefined });
                    }
                  }
                }}
                disabled={existsInOtherResidence}
                placeholder="Enter email address"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'edit-email-error' : undefined}
                className={errors.email ? 'border-destructive' : (existsInOtherResidence ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : '')}
              />
              {errors.email && (
                <p id="edit-email-error" className="text-sm text-destructive" role="alert">
                  {errors.email}
                </p>
              )}
              {existsInOtherResidence && (
                <p className="text-xs text-gray-500 mt-1">
                  Email from existing profile (cannot be changed)
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div className="grid gap-2">
              <Label htmlFor="edit-phoneNumber">Phone Number</Label>
              <Input
                id="edit-phoneNumber"
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
                aria-describedby={errors.phoneNumber ? 'edit-phoneNumber-error' : undefined}
                className={errors.phoneNumber ? 'border-destructive' : (existsInOtherResidence ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : '')}
              />
              {errors.phoneNumber && (
                <p id="edit-phoneNumber-error" className="text-sm text-destructive" role="alert">
                  {errors.phoneNumber}
                </p>
              )}
              {existsInOtherResidence && (
                <p className="text-xs text-gray-500 mt-1">
                  Phone number from existing profile (cannot be changed)
                </p>
              )}
            </div>

            {/* Apartment Number */}
            <div className="grid gap-2">
              <Label htmlFor="edit-apartmentNumber">
                Apartment Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-apartmentNumber"
                value={apartmentNumber}
                onChange={(e) => {
                  setApartmentNumber(e.target.value);
                  if (errors.apartmentNumber) {
                    setErrors({ ...errors, apartmentNumber: undefined });
                  }
                }}
                placeholder="Enter apartment/unit number"
                aria-invalid={!!errors.apartmentNumber}
                aria-describedby={errors.apartmentNumber ? 'edit-apartmentNumber-error' : undefined}
                className={errors.apartmentNumber ? 'border-destructive' : ''}
              />
              {errors.apartmentNumber && (
                <p id="edit-apartmentNumber-error" className="text-sm text-destructive" role="alert">
                  {errors.apartmentNumber}
                </p>
              )}
            </div>

            {/* Residence */}
            <div className="grid gap-2">
              <Label htmlFor="edit-residenceId">
                Residence <span className="text-destructive">*</span>
              </Label>
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
                  id="edit-residenceId"
                  aria-invalid={!!errors.residenceId}
                  aria-describedby={errors.residenceId ? 'edit-residenceId-error' : undefined}
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
              {errors.residenceId && (
                <p id="edit-residenceId-error" className="text-sm text-destructive" role="alert">
                  {errors.residenceId}
                </p>
              )}
            </div>

            {/* Role - Only show for non-syndics */}
            {originalRole !== 'syndic' && !existsInOtherResidence && (
              <div className="grid gap-2">
                <Label htmlFor="edit-role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select value={role} onValueChange={(value: 'resident' | 'guard') => setRole(value)}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resident">Resident</SelectItem>
                    <SelectItem value="guard">Guard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Show read-only role for syndics or residents in other residences */}
            {(originalRole === 'syndic' || existsInOtherResidence) && (
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Input
                  value={originalRole === 'syndic' ? 'Syndic (cannot be changed)' : `${originalRole.charAt(0).toUpperCase() + originalRole.slice(1)} (cannot be changed)`}
                  disabled
                  className="bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200"
                />
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3" role="alert">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <div>
                    {originalRole === 'syndic' ? (
                      <>
                        <p className="font-semibold mb-1">Role: Syndic (cannot be changed)</p>
                        <p>This user already has a syndic role. Cannot be changed but considered as a resident in this residence.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold mb-1">Role: {originalRole.charAt(0).toUpperCase() + originalRole.slice(1)} (cannot be changed)</p>
                        <p>This user already has a {originalRole} role. Cannot be changed. and considered as a resident in this residence.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? 'Updating...' : 'Update Resident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

