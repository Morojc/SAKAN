'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Complaint } from './ComplaintsContent';
import { createComplaint, getResidentsForComplaint } from '@/app/app/complaints/actions';
import toast from 'react-hot-toast';

interface SubmitComplaintDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (complaint: Complaint) => void;
  currentUserResidenceId?: number | null;
  residenceName?: string;
}

/**
 * Submit Complaint Dialog Component
 * Form for residents to submit complaints about other residents
 */
export default function SubmitComplaintDialog({
  open,
  onClose,
  onSuccess,
  currentUserResidenceId,
  residenceName,
}: SubmitComplaintDialogProps) {
  console.log('[SubmitComplaintDialog] Dialog render - open:', open);

  const [submitting, setSubmitting] = useState(false);
  const [loadingResidents, setLoadingResidents] = useState(false);

  // Form state
  const [complainedAboutId, setComplainedAboutId] = useState('');
  const [reason, setReason] = useState<'noise' | 'trash' | 'behavior' | 'parking' | 'pets' | 'property_damage' | 'other' | ''>('');
  const [privacy, setPrivacy] = useState<'private' | 'anonymous'>('private');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Residents list
  const [residents, setResidents] = useState<Array<{ id: string; full_name: string; apartment_number: string | null }>>([]);

  // Validation errors
  const [errors, setErrors] = useState<{
    complainedAboutId?: string;
    reason?: string;
    title?: string;
    description?: string;
  }>({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const fetchResidents = useCallback(async () => {
    if (!currentUserResidenceId) return;

    setLoadingResidents(true);
    try {
      const result = await getResidentsForComplaint(currentUserResidenceId);
      if (result.success && result.data) {
        setResidents(result.data);
      } else {
        toast.error(result.error || 'Failed to load residents');
      }
    } catch (error: any) {
      console.error('[SubmitComplaintDialog] Error fetching residents:', error);
      toast.error('Failed to load residents');
    } finally {
      setLoadingResidents(false);
    }
  }, [currentUserResidenceId]);

  // Fetch residents when dialog opens
  useEffect(() => {
    if (open && currentUserResidenceId) {
      fetchResidents();
    }
  }, [open, currentUserResidenceId, fetchResidents]);

  const resetForm = () => {
    setComplainedAboutId('');
    setReason('');
    setPrivacy('private');
    setTitle('');
    setDescription('');
    setErrors({});
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!complainedAboutId) {
      newErrors.complainedAboutId = 'Please select a resident';
    }

    if (!reason) {
      newErrors.reason = 'Please select a reason';
    }

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[SubmitComplaintDialog] Submitting form');

    // Validate form
    if (!validateForm()) {
      console.log('[SubmitComplaintDialog] Form validation failed');
      toast.error('Please fix the errors in the form');
      return;
    }

    if (!currentUserResidenceId) {
      toast.error('Residence ID is missing');
      return;
    }

    setSubmitting(true);

    try {
      const result = await createComplaint({
        complained_about_id: complainedAboutId,
        reason: reason as any,
        privacy: privacy,
        title: title.trim(),
        description: description.trim(),
        residence_id: currentUserResidenceId,
      });

      if (result.success && result.data) {
        console.log('[SubmitComplaintDialog] Complaint created:', result.data);

        // Transform to Complaint format
        const newComplaint: Complaint = {
          ...result.data,
          complainant_name: 'You',
          complained_about_name: residents.find(r => r.id === complainedAboutId)?.full_name || 'Unknown',
          reviewer_name: null,
          residence_name: residenceName || 'Unknown',
        };

        toast.success('Complaint submitted successfully');
        resetForm();
        onSuccess(newComplaint);
        onClose();
      } else {
        console.error('[SubmitComplaintDialog] Error:', result.error);
        toast.error(result.error || 'Failed to submit complaint');
      }
    } catch (error: any) {
      console.error('[SubmitComplaintDialog] Error creating complaint:', error);
      toast.error(error.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Complaint</DialogTitle>
          <DialogDescription>
            File a complaint about another resident in your residence. Your complaint will be reviewed by the syndic.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Complained About Resident */}
            <div className="space-y-2">
              <Label htmlFor="complainedAbout">
                Complained About Resident <span className="text-destructive">*</span>
              </Label>
              {loadingResidents ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading residents...
                </div>
              ) : (
                <Select
                  value={complainedAboutId}
                  onValueChange={(value) => {
                    setComplainedAboutId(value);
                    setErrors((prev) => ({ ...prev, complainedAboutId: undefined }));
                  }}
                >
                  <SelectTrigger id="complainedAbout" className={errors.complainedAboutId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select a resident" />
                  </SelectTrigger>
                  <SelectContent>
                    {residents.length === 0 ? (
                      <SelectItem value="" disabled>No residents available</SelectItem>
                    ) : (
                      residents.map((resident) => (
                        <SelectItem key={resident.id} value={resident.id}>
                          {resident.full_name}
                          {resident.apartment_number && ` (Apt ${resident.apartment_number})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {errors.complainedAboutId && (
                <p className="text-sm text-destructive">{errors.complainedAboutId}</p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Select
                value={reason}
                onValueChange={(value) => {
                  setReason(value as any);
                  setErrors((prev) => ({ ...prev, reason: undefined }));
                }}
              >
                <SelectTrigger id="reason" className={errors.reason ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noise">Noise</SelectItem>
                  <SelectItem value="trash">Trash</SelectItem>
                  <SelectItem value="behavior">Behavior</SelectItem>
                  <SelectItem value="parking">Parking</SelectItem>
                  <SelectItem value="pets">Pets</SelectItem>
                  <SelectItem value="property_damage">Property Damage</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.reason && (
                <p className="text-sm text-destructive">{errors.reason}</p>
              )}
            </div>

            {/* Privacy */}
            <div className="space-y-2">
              <Label>
                Privacy <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={privacy}
                onValueChange={(value) => setPrivacy(value as 'private' | 'anonymous')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="private" id="private" />
                  <Label htmlFor="private" className="font-normal cursor-pointer">
                    Private (Your name will be visible)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anonymous" id="anonymous" />
                  <Label htmlFor="anonymous" className="font-normal cursor-pointer">
                    Anonymous (Your name will be hidden)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-sm text-muted-foreground">
                {privacy === 'private'
                  ? 'The person you are complaining about will see your name.'
                  : 'Your identity will be kept anonymous from the person you are complaining about. The syndic will still see your name.'}
              </p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Brief summary of the complaint"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Provide details about the complaint..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrors((prev) => ({ ...prev, description: undefined }));
                }}
                rows={6}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Minimum 10 characters required
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingResidents}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Complaint'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

