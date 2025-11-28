'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Upload, X, Image as ImageIcon, Video, Music, File, Download } from 'lucide-react';
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
import { createComplaint, getResidentsForComplaint, uploadComplaintEvidence, addComplaintEvidence } from '@/app/app/complaints/actions';
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
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Form state
  const [complainedAboutId, setComplainedAboutId] = useState('');
  const [reason, setReason] = useState<'noise' | 'trash' | 'behavior' | 'parking' | 'pets' | 'property_damage' | 'other' | ''>('');
  const [privacy, setPrivacy] = useState<'private' | 'anonymous'>('private');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Array<{ file: File; preview: string | null; type: 'image' | 'audio' | 'video' }>>([]);
  const maxFileSizeMB = 50; // Configurable upload limit

  // Residents list
  const [residents, setResidents] = useState<Array<{ id: string; full_name: string; apartment_number: string | null }>>([]);

  // Validation errors
  const [errors, setErrors] = useState<{
    complainedAboutId?: string;
    reason?: string;
    title?: string;
    description?: string;
  }>({});

  // Fetch residents when dialog opens
  useEffect(() => {
    if (open && currentUserResidenceId) {
      fetchResidents();
    }
  }, [open, currentUserResidenceId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const fetchResidents = async () => {
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
  };

  const resetForm = () => {
    setComplainedAboutId('');
    setReason('');
    setPrivacy('private');
    setTitle('');
    setDescription('');
    setSelectedFiles([]);
    setFilePreviews([]);
    setErrors({});
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    console.log('[SubmitComplaintDialog] Files selected:', files.length);

    // Validate each file
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const allowedTypes = [...allowedImageTypes, ...allowedAudioTypes, ...allowedVideoTypes];
    const maxSize = maxFileSizeMB * 1024 * 1024; // Convert MB to bytes

    const validFiles: File[] = [];
    const previews: Array<{ file: File; preview: string | null; type: 'image' | 'audio' | 'video' }> = [];

    files.forEach((file) => {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Please upload an image, audio, or video file.`);
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        toast.error(`${file.name}: File size too large. Maximum size is ${maxFileSizeMB}MB.`);
        return;
      }

      validFiles.push(file);

      // Determine file type
      let fileType: 'image' | 'audio' | 'video';
      if (allowedImageTypes.includes(file.type)) {
        fileType = 'image';
      } else if (allowedAudioTypes.includes(file.type)) {
        fileType = 'audio';
      } else {
        fileType = 'video';
      }

      // Create preview for images
      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews((prev) => {
            const existing = prev.filter((p) => p.file !== file);
            return [...existing, { file, preview: reader.result as string, type: fileType }];
          });
        };
        reader.readAsDataURL(file);
        previews.push({ file, preview: null, type: fileType });
      } else {
        previews.push({ file, preview: null, type: fileType });
      }
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setFilePreviews((prev) => {
      const newPreviews = [...prev];
      validFiles.forEach((file, index) => {
        if (!newPreviews.find((p) => p.file === file)) {
          newPreviews.push(previews[index]);
        }
      });
      return newPreviews;
    });
  };

  // Remove file
  const removeFile = (fileToRemove: File) => {
    setSelectedFiles((prev) => prev.filter((f) => f !== fileToRemove));
    setFilePreviews((prev) => prev.filter((p) => p.file !== fileToRemove));
  };

  // Get file icon
  const getFileIcon = (type: 'image' | 'audio' | 'video') => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
      // Create complaint first
      const result = await createComplaint({
        complained_about_id: complainedAboutId,
        reason: reason as any,
        privacy: privacy,
        title: title.trim(),
        description: description.trim(),
        residence_id: currentUserResidenceId,
      });

      if (!result.success || !result.data) {
        console.error('[SubmitComplaintDialog] Error:', result.error);
        toast.error(result.error || 'Failed to submit complaint');
        return;
      }

      console.log('[SubmitComplaintDialog] Complaint created:', result.data);
      const complaintId = result.data.id;

      // Upload evidence files if any
      if (selectedFiles.length > 0) {
        setUploadingFiles(true);
        try {
          let uploadedCount = 0;
          for (const file of selectedFiles) {
            // Determine file type
            const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
            const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
            let fileType: 'image' | 'audio' | 'video';
            if (allowedImageTypes.includes(file.type)) {
              fileType = 'image';
            } else if (allowedAudioTypes.includes(file.type)) {
              fileType = 'audio';
            } else {
              fileType = 'video';
            }

            // Upload file
            const formData = new FormData();
            formData.append('file', file);

            const uploadResult = await uploadComplaintEvidence(formData, maxFileSizeMB);
            
            if (uploadResult.success && uploadResult.url) {
              // Add evidence to complaint
              const evidenceResult = await addComplaintEvidence(complaintId, {
                file_url: uploadResult.url,
                file_name: uploadResult.fileName || file.name,
                file_type: uploadResult.fileType || fileType,
                file_size: uploadResult.fileSize || file.size,
                mime_type: uploadResult.mimeType || file.type,
              });

              if (evidenceResult.success) {
                uploadedCount++;
              } else {
                console.warn('[SubmitComplaintDialog] Failed to add evidence:', evidenceResult.error);
              }
            } else {
              console.warn('[SubmitComplaintDialog] Failed to upload file:', uploadResult.error);
            }
          }

          if (uploadedCount < selectedFiles.length) {
            toast.error(`Complaint created but only ${uploadedCount} of ${selectedFiles.length} files were uploaded successfully.`);
          } else if (uploadedCount > 0) {
            toast.success(`Complaint created with ${uploadedCount} evidence file(s).`);
          }
        } catch (error: any) {
          console.error('[SubmitComplaintDialog] Error uploading files:', error);
          toast.error('Complaint created but some files failed to upload.');
        } finally {
          setUploadingFiles(false);
        }
      }

      // Transform to Complaint format
      const newComplaint: Complaint = {
        ...result.data,
        complainant_name: 'You',
        complained_about_name: residents.find(r => r.id === complainedAboutId)?.full_name || 'Unknown',
        reviewer_name: null,
        residence_name: residenceName || 'Unknown',
        evidence_count: selectedFiles.length,
      };

      if (selectedFiles.length === 0) {
        toast.success('Complaint submitted successfully');
      }
      
      resetForm();
      onSuccess(newComplaint);
      onClose();
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

            {/* Evidence Upload */}
            <div className="space-y-2">
              <Label htmlFor="evidence">
                Evidence (Optional)
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Upload photos, audio, or videos as evidence. Maximum {maxFileSizeMB}MB per file. Evidence is only visible to the syndic.
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  id="evidence"
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="evidence"
                  className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 rounded-lg p-4 transition-colors"
                >
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">
                    Click to upload evidence
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Photos, audio, or video files up to {maxFileSizeMB}MB each
                  </span>
                </label>
              </div>

              {/* File Previews */}
              {filePreviews.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-medium text-gray-700">
                    Selected Files ({filePreviews.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filePreviews.map((preview, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        {preview.type === 'image' && preview.preview ? (
                          <img
                            src={preview.preview}
                            alt={preview.file.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            {getFileIcon(preview.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {preview.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(preview.file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(preview.file)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingResidents || uploadingFiles}>
              {submitting || uploadingFiles ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingFiles ? 'Uploading files...' : 'Submitting...'}
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

