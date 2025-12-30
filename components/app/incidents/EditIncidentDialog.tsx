'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
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
import { Incident } from './IncidentsContent';
import { updateIncident, uploadIncidentPhoto, getAssignableUsers } from '@/app/app/incidents/actions';
import toast from 'react-hot-toast';

interface EditIncidentDialogProps {
  open: boolean;
  incident: Incident | null;
  onClose: () => void;
  onSuccess: (incident: Incident) => void;
  canManage?: boolean;
  currentUserResidenceId?: number | null;
}

/**
 * Edit Incident Dialog Component
 * Form for editing existing incidents with status/assignment management
 */
export default function EditIncidentDialog({
  open,
  incident,
  onClose,
  onSuccess,
  canManage,
  currentUserResidenceId,
}: EditIncidentDialogProps) {
  console.log('[EditIncidentDialog] Dialog render - open:', open, 'incident:', incident?.id);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; full_name: string; role: string }[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('open');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  // Helper to get display value for Select (convert null/empty to "unassigned")
  const getAssignedToValue = (value: string | null | undefined) => {
    return value && value !== '' ? value : 'unassigned';
  };

  // Validation errors
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
  }>({});

  const loadAssignableUsers = useCallback(async () => {
    if (!currentUserResidenceId) return;
    
    setLoadingAssignableUsers(true);
    console.log('[EditIncidentDialog] Loading assignable users for residence:', currentUserResidenceId);
    
    try {
      const result = await getAssignableUsers(currentUserResidenceId);
      if (result.success && result.data) {
        setAssignableUsers(result.data);
        console.log('[EditIncidentDialog] Loaded', result.data.length, 'assignable users');
      }
    } catch (error) {
      console.error('[EditIncidentDialog] Error loading assignable users:', error);
    } finally {
      setLoadingAssignableUsers(false);
    }
  }, [currentUserResidenceId]);

  // Load assignable users if syndic
  useEffect(() => {
    if (open && canManage && currentUserResidenceId) {
      loadAssignableUsers();
    }
  }, [open, canManage, currentUserResidenceId, loadAssignableUsers]);

  // Initialize form when incident changes
  useEffect(() => {
    if (incident && open) {
      setTitle(incident.title || '');
      setDescription(incident.description || '');
      setStatus(incident.status || 'open');
      setAssignedTo(incident.assigned_to || 'unassigned');
      setExistingPhotoUrl(incident.photo_url || null);
      setPhotoUrl(incident.photo_url || null);
      setSelectedFile(null);
      setFilePreview(null);
      setErrors({});
    }
  }, [incident, open]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[EditIncidentDialog] File selected:', file.name);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an image file.');
      return;
    }

    // Validate file size
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
    console.log('[EditIncidentDialog] Uploading file:', selectedFile.name);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await uploadIncidentPhoto(formData);

      if (result.success && result.url) {
        console.log('[EditIncidentDialog] File uploaded successfully:', result.url);
        return result.url;
      } else {
        toast.error(result.error || 'Failed to upload photo');
        return null;
      }
    } catch (error: any) {
      console.error('[EditIncidentDialog] Error uploading file:', error);
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
    console.log('[EditIncidentDialog] Form submitted');

    if (!incident) {
      toast.error('No incident selected');
      return;
    }

    if (!validateForm()) {
      console.log('[EditIncidentDialog] Validation failed:', errors);
      return;
    }

    setSubmitting(true);

    try {
      // Upload new photo first if selected
      let finalPhotoUrl = photoUrl;
      if (selectedFile) {
        const uploadedUrl = await handleUploadFile();
        if (uploadedUrl) {
          finalPhotoUrl = uploadedUrl;
        } else {
          // Keep existing photo if upload fails
          console.warn('[EditIncidentDialog] Photo upload failed, keeping existing photo');
          finalPhotoUrl = existingPhotoUrl;
        }
      }

      // Update incident
      const updateData: any = {
        id: incident.id,
        title: title.trim(),
        description: description.trim(),
        photo_url: finalPhotoUrl || undefined,
      };

      // Only syndics can update status and assignment
      if (canManage) {
        updateData.status = status;
        updateData.assigned_to = assignedTo === 'unassigned' ? null : assignedTo || null;
      }

      const result = await updateIncident(updateData);

      if (result.success && result.data) {
        console.log('[EditIncidentDialog] Incident updated successfully:', result.data);
        toast.success('Incident updated successfully');
        onSuccess(result.data as Incident);
        onClose();
      } else {
        console.error('[EditIncidentDialog] Error:', result.error);
        toast.error(result.error || 'Failed to update incident');
      }
    } catch (error: any) {
      console.error('[EditIncidentDialog] Error updating incident:', error);
      toast.error(error.message || 'Failed to update incident');
    } finally {
      setSubmitting(false);
    }
  };

  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Edit Incident
          </DialogTitle>
          <DialogDescription>
            Update incident information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="edit-incident-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-incident-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) {
                  setErrors({ ...errors, title: undefined });
                }
              }}
              placeholder="Brief description of the incident..."
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'edit-incident-title-error' : undefined}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p id="edit-incident-title-error" className="text-sm text-destructive" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="edit-incident-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit-incident-description"
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
              aria-describedby={errors.description ? 'edit-incident-description-error' : undefined}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p id="edit-incident-description-error" className="text-sm text-destructive" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Status and Assignment (Syndic only) */}
          {canManage && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-incident-status">Status</Label>
                <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                  <SelectTrigger id="edit-incident-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-incident-assigned">Assign To</Label>
                <Select value={getAssignedToValue(assignedTo)} onValueChange={(value) => setAssignedTo(value === 'unassigned' ? '' : value)}>
                  <SelectTrigger id="edit-incident-assigned">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {loadingAssignableUsers ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
                    ) : (
                      assignableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.role})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Photo Upload */}
          <div className="grid gap-2">
            <Label htmlFor="edit-incident-photo">Photo</Label>
            {existingPhotoUrl && !selectedFile && (
              <div className="mb-2 p-2 bg-gray-50 rounded border">
                <p className="text-sm text-muted-foreground mb-2">Current photo:</p>
                <img
                  src={existingPhotoUrl}
                  alt="Current incident photo"
                  className="max-w-xs max-h-48 rounded border"
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <Input
                id="edit-incident-photo"
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
                      setPhotoUrl(existingPhotoUrl);
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
              Upload a new photo to replace the current one (max 10MB)
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
              {uploading ? 'Uploading...' : submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

