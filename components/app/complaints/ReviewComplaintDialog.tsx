'use client';

import { useState, useEffect } from 'react';
import { Loader2, Download, Image as ImageIcon, Video, Music, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Complaint } from './ComplaintsContent';
import { updateComplaintStatus, getComplaintEvidence } from '@/app/app/complaints/actions';
import toast from 'react-hot-toast';

interface ReviewComplaintDialogProps {
  open: boolean;
  complaint: Complaint;
  onClose: () => void;
  onSuccess: (complaint: Complaint) => void;
}

/**
 * Get reason display text
 */
const getReasonText = (reason: string) => {
  const reasonMap: Record<string, string> = {
    noise: 'Noise',
    trash: 'Trash',
    behavior: 'Behavior',
    parking: 'Parking',
    pets: 'Pets',
    property_damage: 'Property Damage',
    other: 'Other',
  };
  return reasonMap[reason] || reason;
};

/**
 * Review Complaint Dialog Component
 * Allows syndics to review and update complaint status with resolution notes
 */
export default function ReviewComplaintDialog({
  open,
  complaint,
  onClose,
  onSuccess,
}: ReviewComplaintDialogProps) {
  console.log('[ReviewComplaintDialog] Dialog render - open:', open);

  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<Complaint['status']>(complaint.status);
  const [resolutionNotes, setResolutionNotes] = useState(complaint.resolution_notes || '');
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [evidence, setEvidence] = useState<Array<{
    id: number;
    file_url: string;
    file_name: string;
    file_type: 'image' | 'audio' | 'video';
    file_size: number;
    mime_type: string;
    created_at: string;
  }>>([]);

  // Update local state when complaint changes
  useEffect(() => {
    setStatus(complaint.status);
    setResolutionNotes(complaint.resolution_notes || '');
  }, [complaint]);

  // Fetch evidence when dialog opens
  useEffect(() => {
    if (open) {
      fetchEvidence();
    }
  }, [open, complaint.id]);

  const fetchEvidence = async () => {
    setLoadingEvidence(true);
    try {
      const result = await getComplaintEvidence(complaint.id);
      if (result.success && result.data) {
        setEvidence(result.data);
      } else {
        console.error('[ReviewComplaintDialog] Failed to fetch evidence:', result.error);
      }
    } catch (error: any) {
      console.error('[ReviewComplaintDialog] Error fetching evidence:', error);
    } finally {
      setLoadingEvidence(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get file icon
  const getFileIcon = (type: 'image' | 'audio' | 'video') => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-5 w-5" />;
      case 'audio':
        return <Music className="h-5 w-5" />;
      case 'video':
        return <Video className="h-5 w-5" />;
      default:
        return <File className="h-5 w-5" />;
    }
  };

  // Handle file download
  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('File downloaded');
    } catch (error: any) {
      console.error('[ReviewComplaintDialog] Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  async function handleUpdate() {
    console.log('[ReviewComplaintDialog] Updating complaint status');

    setUpdating(true);

    try {
      const result = await updateComplaintStatus({
        id: complaint.id,
        status: status,
        resolution_notes: resolutionNotes.trim() || undefined,
      });

      if (result.success && result.data) {
        console.log('[ReviewComplaintDialog] Complaint updated:', result.data);

        // Transform to Complaint format
        const updatedComplaint: Complaint = {
          ...result.data,
          complainant_name: complaint.complainant_name,
          complained_about_name: complaint.complained_about_name,
          reviewer_name: complaint.reviewer_name,
          residence_name: complaint.residence_name,
        };

        toast.success('Complaint updated successfully');
        onSuccess(updatedComplaint);
        onClose();
      } else {
        console.error('[ReviewComplaintDialog] Error:', result.error);
        toast.error(result.error || 'Failed to update complaint');
      }
    } catch (error: any) {
      console.error('[ReviewComplaintDialog] Error updating complaint:', error);
      toast.error(error.message || 'Failed to update complaint');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Complaint</DialogTitle>
          <DialogDescription>
            Review and update the status of this complaint. Add resolution notes if applicable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Complaint Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Complaint ID</p>
                <p className="text-base font-semibold">#{complaint.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Privacy</p>
                <Badge variant="outline" className={complaint.privacy === 'anonymous' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-700 border-gray-200'}>
                  {complaint.privacy === 'anonymous' ? 'Anonymous' : 'Private'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Complainant</p>
                <p className="text-base">{complaint.complainant_name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {complaint.privacy === 'anonymous' 
                    ? '(Hidden from complained-about resident)' 
                    : '(Visible to complained-about resident)'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Complained About</p>
                <p className="text-base">{complaint.complained_about_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <p className="text-base">{getReasonText(complaint.reason)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-base">{formatDate(complaint.created_at)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Title</p>
              <p className="text-base font-semibold">{complaint.title}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
              <p className="text-base whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {complaint.description}
              </p>
            </div>
          </div>

          {/* Evidence Section (Only visible to syndics) */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Evidence Files</Label>
              {loadingEvidence && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {loadingEvidence ? (
              <p className="text-sm text-muted-foreground">Loading evidence...</p>
            ) : evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence files uploaded.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {evidence.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {file.file_type === 'image' ? (
                      <img
                        src={file.file_url}
                        alt={file.file_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        {getFileIcon(file.file_type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.file_size)} • {file.file_type}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.file_url, file.file_name)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Evidence files are only visible to syndics. The complainant and complained-about resident cannot see these files.
            </p>
          </div>

          {/* Status Update */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="status">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as Complaint['status'])}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label htmlFor="resolutionNotes">
              Resolution Notes
            </Label>
            <Textarea
              id="resolutionNotes"
              placeholder="Add any notes about the resolution or review process..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Optional notes about how the complaint was resolved or reviewed. These notes will be visible to both parties.
            </p>
          </div>

          {/* Existing Resolution Notes */}
          {complaint.resolution_notes && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Previous Resolution Notes</p>
              <p className="text-base whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {complaint.resolution_notes}
              </p>
            </div>
          )}

          {/* Review History */}
          {complaint.reviewed_at && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Review History</p>
              <div className="space-y-1 text-sm">
                {complaint.reviewed_at && (
                  <p className="text-muted-foreground">
                    Reviewed: {formatDate(complaint.reviewed_at)}
                    {complaint.reviewer_name && ` by ${complaint.reviewer_name}`}
                  </p>
                )}
                {complaint.resolved_at && (
                  <p className="text-muted-foreground">
                    Resolved: {formatDate(complaint.resolved_at)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={updating}>
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleUpdate} 
            disabled={updating || status === complaint.status && resolutionNotes.trim() === (complaint.resolution_notes || '').trim()}
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Complaint'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

