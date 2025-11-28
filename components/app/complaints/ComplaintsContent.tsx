'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, AlertCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComplaintsTable from './ComplaintsTable';
import SubmitComplaintDialog from './SubmitComplaintDialog';
import ReviewComplaintDialog from './ReviewComplaintDialog';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

/**
 * Complaint data structure
 */
export interface Complaint {
  id: number;
  residence_id: number;
  complainant_id: string;
  complained_about_id: string;
  reason: 'noise' | 'trash' | 'behavior' | 'parking' | 'pets' | 'property_damage' | 'other';
  privacy: 'private' | 'anonymous';
  title: string;
  description: string;
  status: 'submitted' | 'reviewed' | 'resolved';
  reviewed_at: string | null;
  resolved_at: string | null;
  reviewed_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  complainant_name?: string;
  complained_about_name?: string;
  reviewer_name?: string | null;
  residence_name?: string;
  evidence_count?: number;
}

interface ComplaintsContentProps {
  initialComplaints: Complaint[];
  currentUserId?: string;
  currentUserRole?: string;
  currentUserResidenceId?: number | null;
  residenceName?: string;
}

/**
 * Complaints Content Component
 * Manages state for complaints, filters, and UI interactions
 */
export default function ComplaintsContent({ 
  initialComplaints, 
  currentUserId,
  currentUserRole,
  currentUserResidenceId,
  residenceName,
}: ComplaintsContentProps) {
  console.log('[ComplaintsContent] Component mounted with', initialComplaints.length, 'complaints');

  const router = useRouter();

  // State management
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedComplaintForReview, setSelectedComplaintForReview] = useState<Complaint | null>(null);

  // Sync local state with server data when it refreshes
  useEffect(() => {
    console.log('[ComplaintsContent] Syncing state with server data:', {
      initialComplaintsCount: initialComplaints.length,
      currentComplaintsCount: complaints.length,
    });
    setComplaints(initialComplaints);
  }, [initialComplaints]);

  // Filter complaints based on search, status, and reason
  const filteredComplaints = useMemo(() => {
    console.log('[ComplaintsContent] Filtering complaints...');
    let filtered = [...complaints];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (complaint) =>
          complaint.title.toLowerCase().includes(query) ||
          complaint.description.toLowerCase().includes(query) ||
          complaint.complainant_name?.toLowerCase().includes(query) ||
          complaint.complained_about_name?.toLowerCase().includes(query) ||
          `#COMP-${complaint.id}`.toLowerCase().includes(query)
      );
      console.log('[ComplaintsContent] After search filter:', filtered.length, 'complaints');
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((complaint) => complaint.status === statusFilter);
      console.log('[ComplaintsContent] After status filter:', filtered.length, 'complaints');
    }

    // Reason filter
    if (reasonFilter !== 'all') {
      filtered = filtered.filter((complaint) => complaint.reason === reasonFilter);
      console.log('[ComplaintsContent] After reason filter:', filtered.length, 'complaints');
    }

    console.log('[ComplaintsContent] Final filtered count:', filtered.length);
    return filtered;
  }, [complaints, searchQuery, statusFilter, reasonFilter]);

  /**
   * Handle complaint added
   */
  const handleComplaintAdded = async (complaint: Complaint) => {
    console.log('[ComplaintsContent] Complaint added:', complaint);
    setComplaints((prev) => [complaint, ...prev]);
    router.refresh(); // Refresh server data
    toast.success('Complaint submitted successfully');
  };

  /**
   * Handle complaint updated
   */
  const handleComplaintUpdated = async (updatedComplaint: Complaint) => {
    console.log('[ComplaintsContent] Complaint updated:', updatedComplaint);
    // Update local state with the new data
    setComplaints((prev) =>
      prev.map((c) => (c.id === updatedComplaint.id ? {
        ...updatedComplaint,
        complainant_name: c.complainant_name, // Preserve names
        complained_about_name: c.complained_about_name,
        reviewer_name: updatedComplaint.reviewer_name,
        residence_name: c.residence_name,
      } : c))
    );
    router.refresh(); // Refresh server data
    toast.success('Complaint updated successfully');
  };

  // Check permissions
  const canSubmitComplaint = currentUserRole === 'resident';
  const canReviewComplaints = currentUserRole === 'syndic';

  return (
    <div className="space-y-8 relative pb-20 px-1">
      {/* Header Section with Search, Filters, and Submit Button */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 w-full sm:max-w-md group">
            <AlertCircle className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
            <Input
              placeholder="Search by title, description, ID..."
              value={searchQuery}
              onChange={(e) => {
                console.log('[ComplaintsContent] Search query changed:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 rounded-xl transition-all duration-200 h-11"
              aria-label="Search complaints"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value: string) => {
                console.log('[ComplaintsContent] Status filter changed:', value);
                setStatusFilter(value);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl bg-white border-gray-200" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            {/* Reason Filter */}
            <Select
              value={reasonFilter}
              onValueChange={(value: string) => {
                console.log('[ComplaintsContent] Reason filter changed:', value);
                setReasonFilter(value);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl bg-white border-gray-200" aria-label="Filter by reason">
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="noise">Noise</SelectItem>
                <SelectItem value="trash">Trash</SelectItem>
                <SelectItem value="behavior">Behavior</SelectItem>
                <SelectItem value="parking">Parking</SelectItem>
                <SelectItem value="pets">Pets</SelectItem>
                <SelectItem value="property_damage">Property Damage</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Submit Complaint Button - Desktop */}
        {canSubmitComplaint && (
          <Button
            onClick={() => {
              console.log('[ComplaintsContent] Submit complaint button clicked');
              setShowSubmitDialog(true);
            }}
            className="hidden lg:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-lg shadow-gray-900/20 transition-all hover:scale-105 h-11 rounded-xl px-6"
            aria-label="Submit new complaint"
          >
            <Plus className="h-4 w-4" />
            Submit Complaint
          </Button>
        )}
      </div>

      {/* Complaints Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ComplaintsTable
          complaints={filteredComplaints}
          onReview={(complaint) => {
            console.log('[ComplaintsContent] Review complaint clicked:', complaint);
            setSelectedComplaintForReview(complaint);
          }}
          canReview={canReviewComplaints}
          currentUserId={currentUserId}
        />
      </motion.div>

      {/* Floating Action Button for Submit Complaint - Mobile */}
      {canSubmitComplaint && (
        <Button
          onClick={() => {
            console.log('[ComplaintsContent] Submit complaint button clicked (mobile)');
            setShowSubmitDialog(true);
          }}
          size="lg"
          className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 z-[100] bg-gray-900 hover:bg-gray-800 text-white border-0"
          aria-label="Submit new complaint"
        >
          <Plus className="h-6 w-6 text-white" />
          <span className="sr-only">Submit Complaint</span>
        </Button>
      )}

      {/* Submit Complaint Dialog */}
      {canSubmitComplaint && (
        <SubmitComplaintDialog
          open={showSubmitDialog}
          onClose={() => {
            console.log('[ComplaintsContent] Submit dialog closed');
            setShowSubmitDialog(false);
          }}
          onSuccess={handleComplaintAdded}
          currentUserResidenceId={currentUserResidenceId}
          residenceName={residenceName}
        />
      )}

      {/* Review Complaint Dialog */}
      {canReviewComplaints && selectedComplaintForReview && (
        <ReviewComplaintDialog
          open={!!selectedComplaintForReview}
          complaint={selectedComplaintForReview}
          onClose={() => {
            console.log('[ComplaintsContent] Review dialog closed');
            setSelectedComplaintForReview(null);
          }}
          onSuccess={handleComplaintUpdated}
        />
      )}
    </div>
  );
}

