'use client';

import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
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

  // Validation errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    apartmentNumber?: string;
    residenceId?: string;
  }>({});

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
          residence_id: result.resident.residence_id,
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
            {/* Full Name */}
            <div className="grid gap-2">
              <Label htmlFor="edit-fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-fullName"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) {
                    setErrors({ ...errors, fullName: undefined });
                  }
                }}
                placeholder="Enter full name"
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'edit-fullName-error' : undefined}
                className={errors.fullName ? 'border-destructive' : ''}
              />
              {errors.fullName && (
                <p id="edit-fullName-error" className="text-sm text-destructive" role="alert">
                  {errors.fullName}
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
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors({ ...errors, email: undefined });
                  }
                }}
                placeholder="Enter email address"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'edit-email-error' : undefined}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p id="edit-email-error" className="text-sm text-destructive" role="alert">
                  {errors.email}
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
                  setPhoneNumber(e.target.value);
                  if (errors.phoneNumber) {
                    setErrors({ ...errors, phoneNumber: undefined });
                  }
                }}
                placeholder="Enter phone number (optional)"
                aria-invalid={!!errors.phoneNumber}
                aria-describedby={errors.phoneNumber ? 'edit-phoneNumber-error' : undefined}
                className={errors.phoneNumber ? 'border-destructive' : ''}
              />
              {errors.phoneNumber && (
                <p id="edit-phoneNumber-error" className="text-sm text-destructive" role="alert">
                  {errors.phoneNumber}
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
            {originalRole !== 'syndic' && (
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
            
            {/* Show read-only role for syndics */}
            {originalRole === 'syndic' && (
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <div className="px-3 py-2 border rounded-md bg-muted text-sm">
                  Syndic (cannot be changed)
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

