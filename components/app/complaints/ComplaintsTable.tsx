'use client';

import { useState } from 'react';
import { MoreVertical, Eye, AlertCircle, Paperclip } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Complaint } from './ComplaintsContent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ComplaintsTableProps {
  complaints: Complaint[];
  onReview: (complaint: Complaint) => void;
  canReview?: boolean;
  currentUserId?: string;
}

/**
 * Get status badge color
 */
const getStatusBadgeColor = (status: string) => {
  const colors: Record<string, string> = {
    submitted: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    reviewed: 'bg-blue-100 text-blue-800 border-blue-300',
    resolved: 'bg-green-100 text-green-800 border-green-300',
  };
  return colors[status] || colors.submitted;
};

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
 * Get privacy badge
 */
const getPrivacyBadge = (privacy: string) => {
  return privacy === 'anonymous' ? (
    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
      Anonymous
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
      Private
    </Badge>
  );
};

/**
 * Complaints Table Component
 * Displays complaints in a table with privacy handling
 */
export default function ComplaintsTable({
  complaints,
  onReview,
  canReview,
  currentUserId,
}: ComplaintsTableProps) {
  console.log('[ComplaintsTable] Rendering with', complaints.length, 'complaints');

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateString);
  };

  // Get complainant display name based on privacy and viewer
  const getComplainantDisplay = (complaint: Complaint, viewerId?: string) => {
    // Syndics always see the complainant name
    if (canReview) {
      return complaint.complainant_name || 'Unknown';
    }
    
    // If viewer is the complainant, show their name
    if (viewerId === complaint.complainant_id) {
      return 'You';
    }
    
    // If viewer is the complained-about resident
    if (viewerId === complaint.complained_about_id) {
      // Anonymous complaints hide the complainant
      if (complaint.privacy === 'anonymous') {
        return 'Anonymous';
      }
      // Private complaints show the name
      return complaint.complainant_name || 'Unknown';
    }
    
    // Default fallback
    return complaint.complainant_name || 'Unknown';
  };

  if (complaints.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
        <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No complaints found</h3>
        <p className="text-gray-500">No complaints match your current filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200">
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead className="min-w-[200px]">Title</TableHead>
                <TableHead className="w-[140px]">Complainant</TableHead>
                <TableHead className="w-[140px]">Complained About</TableHead>
                <TableHead className="w-[120px]">Reason</TableHead>
                <TableHead className="w-[100px]">Privacy</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                {canReview && <TableHead className="w-[100px]">Evidence</TableHead>}
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complaints.map((complaint) => (
                <TableRow 
                  key={complaint.id} 
                  className="border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => {
                    setSelectedComplaint(complaint);
                    setViewDialogOpen(true);
                  }}
                >
                  <TableCell className="font-mono text-sm">
                    #{complaint.id}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px]">
                      <p className="font-medium truncate" title={complaint.title}>
                        {complaint.title}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-gray-900">
                      {getComplainantDisplay(complaint, currentUserId)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-gray-900">
                      {complaint.complained_about_name || 'Unknown'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {getReasonText(complaint.reason)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getPrivacyBadge(complaint.privacy)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getStatusBadgeColor(complaint.status)}
                    >
                      {complaint.status}
                    </Badge>
                  </TableCell>
                  {canReview && (
                    <TableCell>
                      {complaint.evidence_count && complaint.evidence_count > 0 ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Paperclip className="h-4 w-4" />
                          <span>{complaint.evidence_count} file(s)</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No evidence</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatRelativeTime(complaint.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedComplaint(complaint);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {canReview && (
                          <DropdownMenuItem
                            onClick={() => {
                              onReview(complaint);
                            }}
                          >
                            Review
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* View Details Dialog */}
      {selectedComplaint && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Complaint Details</DialogTitle>
              <DialogDescription>
                View complete complaint information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ID</p>
                  <p className="text-base font-semibold">#{selectedComplaint.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={getStatusBadgeColor(selectedComplaint.status)}
                  >
                    {selectedComplaint.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Complainant</p>
                  <p className="text-base">
                    {getComplainantDisplay(selectedComplaint, currentUserId)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Complained About</p>
                  <p className="text-base">
                    {selectedComplaint.complained_about_name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reason</p>
                  <p className="text-base">{getReasonText(selectedComplaint.reason)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Privacy</p>
                  {getPrivacyBadge(selectedComplaint.privacy)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-base">{formatDate(selectedComplaint.created_at)}</p>
                </div>
                {selectedComplaint.reviewed_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reviewed</p>
                    <p className="text-base">{formatDate(selectedComplaint.reviewed_at)}</p>
                  </div>
                )}
                {selectedComplaint.resolved_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                    <p className="text-base">{formatDate(selectedComplaint.resolved_at)}</p>
                  </div>
                )}
                {selectedComplaint.reviewer_name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reviewed By</p>
                    <p className="text-base">{selectedComplaint.reviewer_name}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Title</p>
                <p className="text-base font-semibold">{selectedComplaint.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                <p className="text-base whitespace-pre-wrap">{selectedComplaint.description}</p>
              </div>
              {selectedComplaint.resolution_notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Resolution Notes</p>
                  <p className="text-base whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                    {selectedComplaint.resolution_notes}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

