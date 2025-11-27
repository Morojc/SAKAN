'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
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
import { Incident } from './IncidentsContent';
import { createIncident, uploadIncidentPhoto } from '@/app/app/incidents/actions';
import toast from 'react-hot-toast';

interface IncidentReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (incident: Incident) => void;
  currentUserResidenceId?: number | null;
  residenceName?: string;
}

/**
 * Report Incident Dialog Component
 * Form for reporting new incidents with photo upload
 */
export default function IncidentReportDialog({
  open,
  onClose,
  onSuccess,
  currentUserResidenceId,
  residenceName,
}: IncidentReportDialogProps) {
  console.log('[IncidentReportDialog] Dialog render - open:', open);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
  }>({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    setFilePreview(null);
    setPhotoUrl(null);
    setErrors({});
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[IncidentReportDialog] File selected:', file.name);

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an image file.');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File size too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload file before submitting
  const handleUploadFile = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    setUploading(true);
    console.log('[IncidentReportDialog] Uploading file:', selectedFile.name);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await uploadIncidentPhoto(formData);

      if (result.success && result.url) {
        console.log('[IncidentReportDialog] File uploaded successfully:', result.url);
        return result.url;
      } else {
        toast.error(result.error || 'Failed to upload photo');
        return null;
      }
    } catch (error: any) {
      console.error('[IncidentReportDialog] Error uploading file:', error);
      toast.error(error.message || 'Failed to upload photo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[IncidentReportDialog] Form submitted');

    if (!validateForm()) {
      console.log('[IncidentReportDialog] Validation failed:', errors);
      return;
    }

    if (!currentUserResidenceId) {
      toast.error('Residence ID is required');
      return;
    }

    setSubmitting(true);

    try {
      // Upload photo first if selected
      let finalPhotoUrl = photoUrl;
      if (selectedFile) {
        const uploadedUrl = await handleUploadFile();
        if (uploadedUrl) {
          finalPhotoUrl = uploadedUrl;
        } else {
          // User can still submit without photo if upload fails
          console.warn('[IncidentReportDialog] Photo upload failed, continuing without photo');
        }
      }

      // Create incident
      const result = await createIncident({
        title: title.trim(),
        description: description.trim(),
        residence_id: currentUserResidenceId,
        photo_url: finalPhotoUrl || undefined,
      });

      if (result.success && result.data) {
        console.log('[IncidentReportDialog] Incident created successfully:', result.data);
        toast.success('Incident reported successfully');
        const incidentData = result.data as any;
        onSuccess({
          ...incidentData,
          reporter_name: 'You', // Will be updated by server
        } as Incident);
        resetForm();
        onClose();
      } else {
        console.error('[IncidentReportDialog] Error:', result.error);
        toast.error(result.error || 'Failed to report incident');
      }
    } catch (error: any) {
      console.error('[IncidentReportDialog] Error creating incident:', error);
      toast.error(error.message || 'Failed to report incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Report New Incident
          </DialogTitle>
          <DialogDescription>
            Report a maintenance issue or incident for {residenceName || 'your residence'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="incident-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="incident-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) {
                  setErrors({ ...errors, title: undefined });
                }
              }}
              placeholder="Brief description of the incident..."
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'incident-title-error' : undefined}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p id="incident-title-error" className="text-sm text-destructive" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="incident-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="incident-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) {
                  setErrors({ ...errors, description: undefined });
                }
              }}
              placeholder="Provide detailed information about the incident..."
              rows={5}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'incident-description-error' : undefined}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p id="incident-description-error" className="text-sm text-destructive" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Photo Upload */}
          <div className="grid gap-2">
            <Label htmlFor="incident-photo">Photo (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="incident-photo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                      setPhotoUrl(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {filePreview && (
              <div className="mt-2">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="max-w-xs max-h-48 rounded border"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload a photo of the incident (max 10MB)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting || uploading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || uploading}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {(submitting || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Uploading...' : submitting ? 'Reporting...' : 'Report Incident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

