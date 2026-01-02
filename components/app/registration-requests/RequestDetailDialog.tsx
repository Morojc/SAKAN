'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { approveRegistrationRequest, rejectRegistrationRequest, type RegistrationRequest } from '@/app/actions/registration-requests';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface RequestDetailDialogProps {
  request: RegistrationRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestUpdated: () => void;
}

export default function RequestDetailDialog({
  request,
  open,
  onOpenChange,
  onRequestUpdated,
}: RequestDetailDialogProps) {
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const isPending = request.status === 'pending';

  const handleApprove = async () => {
    setProcessing(true);
    const result = await approveRegistrationRequest(request.id);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message || 'Registration approved!');
      onRequestUpdated();
    }
    setProcessing(false);
    setShowApproveConfirm(false);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }

    setProcessing(true);
    const result = await rejectRegistrationRequest(request.id, rejectionReason);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message || 'Registration rejected');
      onRequestUpdated();
    }
    setProcessing(false);
    setShowRejectDialog(false);
  };

  const quickRejectReasons = [
    'Apartment already occupied',
    'Invalid or unclear documentation',
    'Not authorized for this residence',
    'Duplicate registration attempt',
    'Information does not match records',
  ];

  return (
    <>
      <Dialog open={open && !showApproveConfirm && !showRejectDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration Request Details</DialogTitle>
            <DialogDescription>
              Review the applicant's information and documentation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{request.full_name}</h3>
              {request.status === 'pending' ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Pending Review
                </Badge>
              ) : request.status === 'approved' ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Approved
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  Rejected
                </Badge>
              )}
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500">Email Address</Label>
                <p className="font-medium">{request.email}</p>
              </div>
              <div>
                <Label className="text-gray-500">Phone Number</Label>
                <p className="font-medium">{request.phone_number}</p>
              </div>
              <div>
                <Label className="text-gray-500">Apartment Number</Label>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {request.apartment_number}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Submission Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-gray-500">Submitted</Label>
                <p>{format(new Date(request.created_at), 'PPpp')}</p>
              </div>
              {request.reviewed_at && (
                <div>
                  <Label className="text-gray-500">Reviewed</Label>
                  <p>{format(new Date(request.reviewed_at), 'PPpp')}</p>
                </div>
              )}
            </div>

            {/* Rejection Reason */}
            {request.status === 'rejected' && request.rejection_reason && (
              <>
                <Separator />
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <Label className="text-red-900 font-semibold">Rejection Reason</Label>
                  <p className="text-red-800 mt-1">{request.rejection_reason}</p>
                </div>
              </>
            )}
          </div>

          {isPending && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                className="gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
              <Button
                onClick={() => setShowApproveConfirm(true)}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Registration?</DialogTitle>
            <DialogDescription>
              This will create a user account and send a welcome email with an onboarding code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>{request.full_name}</strong> will be registered as a resident for Apartment{' '}
                <strong>{request.apartment_number}</strong>.
              </p>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ User account will be created</li>
              <li>✓ 6-digit onboarding code will be generated</li>
              <li>✓ Welcome email will be sent to {request.email}</li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveConfirm(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be sent to the applicant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                The applicant will be notified via email with your rejection reason.
              </p>
            </div>

            <div>
              <Label>Quick Select Reason</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {quickRejectReasons.map((reason) => (
                  <Button
                    key={reason}
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectionReason(reason)}
                    className="justify-start text-left"
                  >
                    {reason}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a detailed reason for rejection..."
                rows={4}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || rejectionReason.trim().length < 10}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Confirm Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

