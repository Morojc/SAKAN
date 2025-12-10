'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, AlertCircle, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import IncidentsTable from './IncidentsTable';
import IncidentReportDialog from './IncidentReportDialog';
import EditIncidentDialog from './EditIncidentDialog';
import DeleteIncidentDialog from './DeleteIncidentDialog';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { deleteIncident } from '@/app/app/incidents/actions';

/**
 * Incident data structure
 */
export interface Incident {
  id: number;
  residence_id: number;
  user_id: string;
  title: string;
  description: string;
  photo_url: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string;
  assignee_name?: string | null;
  residence_name?: string;
}

interface IncidentsContentProps {
  initialIncidents: Incident[];
  currentUserId?: string;
  currentUserRole?: string;
  currentUserResidenceId?: number | null;
  residenceName?: string;
}

/**
 * Incidents Content Component
 * Manages state for incidents, filters, and UI interactions
 */
export default function IncidentsContent({ 
  initialIncidents, 
  currentUserId,
  currentUserRole,
  currentUserResidenceId,
  residenceName,
}: IncidentsContentProps) {
  console.log('[IncidentsContent] Component mounted with', initialIncidents.length, 'incidents');

  const router = useRouter();

  // State management
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedIncidentForEdit, setSelectedIncidentForEdit] = useState<Incident | null>(null);
  const [selectedIncidentForDelete, setSelectedIncidentForDelete] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Sync local state with server data when it refreshes
  useEffect(() => {
    console.log('[IncidentsContent] Syncing state with server data:', {
      initialIncidentsCount: initialIncidents.length,
      currentIncidentsCount: incidents.length,
    });
    setIncidents(initialIncidents);
  }, [initialIncidents]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('[IncidentsContent] State updated:', {
      incidentsCount: incidents.length,
      searchQuery,
      statusFilter,
      viewMode,
    });
  }, [incidents, searchQuery, statusFilter, viewMode]);

  // Filter incidents based on search and status
  const filteredIncidents = useMemo(() => {
    console.log('[IncidentsContent] Filtering incidents...');
    let filtered = [...incidents];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (incident) =>
          incident.title.toLowerCase().includes(query) ||
          incident.description.toLowerCase().includes(query) ||
          incident.reporter_name?.toLowerCase().includes(query) ||
          `#INC-${incident.id}`.toLowerCase().includes(query)
      );
      console.log('[IncidentsContent] After search filter:', filtered.length, 'incidents');
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((incident) => incident.status === statusFilter);
      console.log('[IncidentsContent] After status filter:', filtered.length, 'incidents');
    }

    console.log('[IncidentsContent] Final filtered count:', filtered.length);
    return filtered;
  }, [incidents, searchQuery, statusFilter]);

  /**
   * Handle incident added
   */
  const handleIncidentAdded = async (incident: Incident) => {
    console.log('[IncidentsContent] Incident added:', incident);
    setIncidents((prev) => [incident, ...prev]);
    router.refresh(); // Refresh server data
    toast.success('Incident reported successfully');
  };

  /**
   * Handle incident updated
   */
  const handleIncidentUpdated = async (updatedIncident: Incident) => {
    console.log('[IncidentsContent] Incident updated:', updatedIncident);
    // Update local state with the new data
    setIncidents((prev) =>
      prev.map((i) => (i.id === updatedIncident.id ? {
        ...updatedIncident,
        reporter_name: i.reporter_name, // Preserve reporter name
        assignee_name: updatedIncident.assignee_name,
        residence_name: i.residence_name, // Preserve residence name
      } : i))
    );
    router.refresh(); // Refresh server data
    toast.success('Incident updated successfully');
  };

  /**
   * Handle incident deleted
   */
  const handleIncidentDeleted = async (incidentId: number) => {
    console.log('[IncidentsContent] Deleting incident:', incidentId);
    setLoading(true);

    try {
      const result = await deleteIncident(incidentId);
      if (result.success) {
        setIncidents((prev) => prev.filter((i) => i.id !== incidentId));
        router.refresh(); // Refresh server data
        toast.success('Incident deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete incident');
      }
    } catch (error: any) {
      console.error('[IncidentsContent] Error deleting incident:', error);
      toast.error(error.message || 'Failed to delete incident');
    } finally {
      setLoading(false);
    }
  };

  // Check permissions
  const canReportIncident = currentUserRole === 'resident' || currentUserRole === 'syndic';
  const canManageIncidents = currentUserRole === 'syndic';
  // const canViewAll = currentUserRole === 'syndic' || currentUserRole === 'guard';

  return (
    <div className="space-y-8 relative pb-20 px-1">
      {/* Header Section with Search, Filters, View Toggle, and Report Button */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 w-full sm:max-w-md group">
            <AlertCircle className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
            <Input
              placeholder="Search by title, description, ID..."
              value={searchQuery}
              onChange={(e) => {
                console.log('[IncidentsContent] Search query changed:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 rounded-xl transition-all duration-200 h-11"
              aria-label="Search incidents"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value: string) => {
                console.log('[IncidentsContent] Status filter changed:', value);
                setStatusFilter(value);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl bg-white border-gray-200" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 h-11">
              <button
                onClick={() => {
                  console.log('[IncidentsContent] View mode changed to list');
                  setViewMode('list');
                }}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                aria-label="List view"
              >
                <TableIcon size={18} />
              </button>
              <button
                onClick={() => {
                  console.log('[IncidentsContent] View mode changed to kanban');
                  setViewMode('kanban');
                }}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'kanban' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                aria-label="Kanban view"
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Report Incident Button - Desktop */}
        {canReportIncident && (
          <Button
            onClick={() => {
              console.log('[IncidentsContent] Report incident button clicked');
              setShowReportDialog(true);
            }}
            className="hidden lg:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-lg shadow-gray-900/20 transition-all hover:scale-105 h-11 rounded-xl px-6"
            aria-label="Report new incident"
          >
            <Plus className="h-4 w-4" />
            Report Incident
          </Button>
        )}
      </div>

      {/* Incidents View (Table or Kanban) */}
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <IncidentsTable
          incidents={filteredIncidents}
          viewMode={viewMode}
          onEdit={(incident) => {
            console.log('[IncidentsContent] Edit incident clicked:', incident);
            setSelectedIncidentForEdit(incident);
          }}
          onDelete={(incident) => {
            console.log('[IncidentsContent] Delete incident clicked:', incident);
            setSelectedIncidentForDelete(incident);
          }}
          loading={loading}
          canManage={canManageIncidents}
          currentUserId={currentUserId}
        />
      </motion.div>

      {/* Floating Action Button for Report Incident - Mobile */}
      {canReportIncident && (
        <Button
          onClick={() => {
            console.log('[IncidentsContent] Report incident button clicked (mobile)');
            setShowReportDialog(true);
          }}
          size="lg"
          className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 z-[100] bg-gray-900 hover:bg-gray-800 text-white border-0"
          aria-label="Report new incident"
        >
          <Plus className="h-6 w-6 text-white" />
          <span className="sr-only">Report Incident</span>
        </Button>
      )}

      {/* Report Incident Dialog */}
      {canReportIncident && (
        <IncidentReportDialog
          open={showReportDialog}
          onClose={() => {
            console.log('[IncidentsContent] Report dialog closed');
            setShowReportDialog(false);
          }}
          onSuccess={handleIncidentAdded}
          currentUserResidenceId={currentUserResidenceId}
          residenceName={residenceName}
        />
      )}

      {/* Edit Incident Dialog */}
      {selectedIncidentForEdit && (
        <EditIncidentDialog
          open={!!selectedIncidentForEdit}
          incident={selectedIncidentForEdit}
          onClose={() => {
            console.log('[IncidentsContent] Edit dialog closed');
            setSelectedIncidentForEdit(null);
          }}
          onSuccess={handleIncidentUpdated}
          canManage={canManageIncidents}
          currentUserResidenceId={currentUserResidenceId}
        />
      )}

      {/* Delete Incident Dialog */}
      {canManageIncidents && selectedIncidentForDelete && (
        <DeleteIncidentDialog
          open={!!selectedIncidentForDelete}
          incident={selectedIncidentForDelete}
          onClose={() => {
            console.log('[IncidentsContent] Delete dialog closed');
            setSelectedIncidentForDelete(null);
          }}
          onConfirm={() => {
            if (selectedIncidentForDelete) {
              handleIncidentDeleted(selectedIncidentForDelete.id);
              setSelectedIncidentForDelete(null);
            }
          }}
        />
      )}
    </div>
  );
}

