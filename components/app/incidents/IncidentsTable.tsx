'use client';

import { useState, useMemo } from 'react';
import { MoreVertical, Edit, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, AlertCircle } from 'lucide-react';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Incident } from './IncidentsContent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { updateIncident } from '@/app/app/incidents/actions';
import toast from 'react-hot-toast';

interface IncidentsTableProps {
  incidents: Incident[];
  viewMode: 'list' | 'kanban';
  onEdit: (incident: Incident) => void;
  onDelete: (incident: Incident) => void;
  loading?: boolean;
  canManage?: boolean;
  currentUserId?: string;
}

type SortField = 'date' | 'title' | 'status' | null;
type SortDirection = 'asc' | 'desc';

/**
 * Get status badge color
 */
const getStatusBadgeColor = (status: string) => {
  const colors: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
    resolved: 'bg-green-100 text-green-800 border-green-300',
    closed: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return colors[status] || colors.open;
};

/**
 * Incidents Table Component
 * Displays incidents in list or kanban view
 */
export default function IncidentsTable({
  incidents,
  viewMode,
  onEdit,
  onDelete,
  loading,
  canManage,
  currentUserId,
}: IncidentsTableProps) {
  console.log('[IncidentsTable] Rendering with', incidents.length, 'incidents, viewMode:', viewMode);

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  // Handle sorting
  const handleSort = (field: SortField) => {
    console.log('[IncidentsTable] Sorting by', field, 'Current:', sortField, sortDirection);
    if (sortField === field) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sorted incidents
  const sortedIncidents = useMemo(() => {
    if (!sortField || viewMode === 'kanban') {
      return incidents;
    }

    const sorted = [...incidents].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [incidents, sortField, sortDirection, viewMode]);

  // Group incidents by status for kanban view
  const incidentsByStatus = useMemo(() => {
    const grouped: Record<string, Incident[]> = {
      open: [],
      in_progress: [],
      resolved: [],
      closed: [],
    };

    sortedIncidents.forEach((incident) => {
      if (grouped[incident.status]) {
        grouped[incident.status].push(incident);
      }
    });

    return grouped;
  }, [sortedIncidents]);

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

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1.5 text-muted-foreground opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1.5 text-primary" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1.5 text-primary" />
    );
  };

  // Handle status update
  const handleStatusUpdate = async (incidentId: number, newStatus: string) => {
    if (!canManage) return;

    setUpdatingStatus(incidentId);
    console.log('[IncidentsTable] Updating status for incident:', incidentId, 'to:', newStatus);

    try {
      const result = await updateIncident({
        id: incidentId,
        status: newStatus as any,
      });

      if (result.success && result.data) {
        toast.success('Status updated successfully');
        // Update will be reflected via router.refresh() in parent
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('[IncidentsTable] Error updating status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow animate-pulse">
            <div className="h-6 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
        <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No incidents reported</h3>
        <p className="text-gray-500">Report an incident to get started.</p>
      </div>
    );
  }

  // Kanban View
  if (viewMode === 'kanban') {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['open', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
            <div key={status} className="flex flex-col">
              <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="text-sm font-semibold text-gray-700 capitalize">
                  {status.replace('_', ' ')} ({incidentsByStatus[status]?.length || 0})
                </h3>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                {(incidentsByStatus[status] || []).map((incident) => (
                  <Card
                    key={incident.id}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedIncident(incident);
                      setViewDialogOpen(true);
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-sm line-clamp-1">{incident.title}</h4>
                        <Badge
                          variant="outline"
                          className={`${getStatusBadgeColor(incident.status)} text-xs`}
                        >
                          {status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {incident.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>#{incident.id}</span>
                        <span>{formatRelativeTime(incident.created_at)}</span>
                      </div>
                      {incident.photo_url && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          <span>Has photo</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
                {incidentsByStatus[status]?.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No incidents
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* View Details Dialog */}
        {selectedIncident && (
          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Incident Details</DialogTitle>
                <DialogDescription>
                  View complete incident information
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ID</p>
                    <p className="text-base font-semibold">#{selectedIncident.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge
                      variant="outline"
                      className={getStatusBadgeColor(selectedIncident.status)}
                    >
                      {selectedIncident.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reporter</p>
                    <p className="text-base">{selectedIncident.reporter_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
                    <p className="text-base">{selectedIncident.assignee_name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="text-base">{formatDate(selectedIncident.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                    <p className="text-base">{formatRelativeTime(selectedIncident.updated_at)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Title</p>
                  <p className="text-base font-semibold">{selectedIncident.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                  <p className="text-base">{selectedIncident.description}</p>
                </div>
                {selectedIncident.photo_url && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Photo</p>
                    <img
                      src={selectedIncident.photo_url}
                      alt="Incident photo"
                      className="max-w-full max-h-64 rounded border"
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // List/Table View
  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200">
                <TableHead className="w-[100px]">
                  <button
                    onClick={() => handleSort(null)}
                    className="flex items-center font-semibold hover:text-primary transition-colors"
                    aria-label="Sort by ID"
                  >
                    ID
                  </button>
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center font-semibold hover:text-primary transition-colors"
                    aria-label="Sort by title"
                  >
                    Title
                    {getSortIcon('title')}
                  </button>
                </TableHead>
                <TableHead className="w-[140px]">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center font-semibold hover:text-primary transition-colors"
                    aria-label="Sort by status"
                  >
                    Status
                    {getSortIcon('status')}
                  </button>
                </TableHead>
                <TableHead className="w-[140px]">Reporter</TableHead>
                <TableHead className="w-[140px]">Assigned To</TableHead>
                <TableHead className="w-[100px] text-center">Photo</TableHead>
                <TableHead className="w-[120px]">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center font-semibold hover:text-primary transition-colors"
                    aria-label="Sort by date"
                  >
                    Created
                    {getSortIcon('date')}
                  </button>
                </TableHead>
                {(canManage || currentUserId) && <TableHead className="w-[80px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedIncidents.map((incident) => (
                <TableRow key={incident.id} className="border-gray-100 hover:bg-gray-50/50">
                  <TableCell className="font-mono text-sm">
                    #{incident.id}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px]">
                      <p className="font-medium truncate" title={incident.title}>
                        {incident.title}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={incident.status}
                        onValueChange={(value) => handleStatusUpdate(incident.id, value)}
                        disabled={updatingStatus === incident.id}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant="outline"
                        className={getStatusBadgeColor(incident.status)}
                      >
                        {incident.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {incident.reporter_name || 'Unknown'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {incident.assignee_name || 'Unassigned'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {incident.photo_url ? (
                      <button
                        onClick={() => {
                          setSelectedIncident(incident);
                          setViewDialogOpen(true);
                        }}
                        className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
                        aria-label="View photo"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground" title={formatDate(incident.created_at)}>
                      {formatRelativeTime(incident.created_at)}
                    </span>
                  </TableCell>
                  {(canManage || incident.user_id === currentUserId) && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedIncident(incident);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onEdit(incident)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem
                              onClick={() => onDelete(incident)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* View Details Dialog */}
      {selectedIncident && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Incident Details</DialogTitle>
              <DialogDescription>
                View complete incident information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ID</p>
                  <p className="text-base font-semibold">#{selectedIncident.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={getStatusBadgeColor(selectedIncident.status)}
                  >
                    {selectedIncident.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reporter</p>
                  <p className="text-base">{selectedIncident.reporter_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
                  <p className="text-base">{selectedIncident.assignee_name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-base">{formatDate(selectedIncident.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p className="text-base">{formatRelativeTime(selectedIncident.updated_at)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Title</p>
                <p className="text-base font-semibold">{selectedIncident.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                <p className="text-base whitespace-pre-wrap">{selectedIncident.description}</p>
              </div>
              {selectedIncident.photo_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Photo</p>
                  <img
                    src={selectedIncident.photo_url}
                    alt="Incident photo"
                    className="max-w-full max-h-64 rounded border"
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

