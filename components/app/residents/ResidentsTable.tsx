'use client';

import { useState, useMemo } from 'react';
import { MoreVertical, Edit, Trash2, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, Users, ChevronDown } from 'lucide-react';
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
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResidentWithFees, Fee } from './ResidentsContent';
import AddFeeDialog from './AddFeeDialog';
import EditResidentDialog from './EditResidentDialog';
import DeleteResidentDialog from './DeleteResidentDialog';

interface ResidentsTableProps {
  residents: ResidentWithFees[];
  onEdit: (resident: ResidentWithFees) => void;
  onDelete: (residentId: string) => void;
  onAddFee: (fee: Fee) => void;
  onUpdateFee?: (fee: Fee) => void;
  loading?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

type SortField = 'name' | 'apartment' | 'outstandingFees' | 'feeCount' | null;
type SortDirection = 'asc' | 'desc';

/**
 * Residents Table Component
 * Modern table design with enhanced UX using shadcn/ui components
 */
export default function ResidentsTable({
  residents,
  onEdit,
  onDelete,
  onAddFee,
  onUpdateFee,
  loading,
  currentUserId,
  currentUserRole,
}: ResidentsTableProps) {
  console.log('[ResidentsTable] Rendering with', residents.length, 'residents');

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedResidentForFee, setSelectedResidentForFee] = useState<string | null>(null);
  const [selectedResidentForEdit, setSelectedResidentForEdit] = useState<ResidentWithFees | null>(null);
  const [selectedResidentForDelete, setSelectedResidentForDelete] = useState<ResidentWithFees | null>(null);

  // Handle sorting
  const handleSort = (field: SortField) => {
    console.log('[ResidentsTable] Sorting by', field, 'Current:', sortField, sortDirection);
    if (sortField === field) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      console.log('[ResidentsTable] Toggled sort direction to', newDirection);
    } else {
      setSortField(field);
      setSortDirection('asc');
      console.log('[ResidentsTable] Changed sort field to', field);
    }
  };

  // Sorted residents
  const sortedResidents = useMemo(() => {
    if (!sortField) {
      console.log('[ResidentsTable] No sort applied, returning original order');
      return residents;
    }

    console.log('[ResidentsTable] Sorting residents by', sortField, sortDirection);

    const sorted = [...residents].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.full_name.localeCompare(b.full_name);
          break;
        case 'apartment':
          comparison = (a.apartment_number || '').localeCompare(b.apartment_number || '');
          break;
        case 'outstandingFees':
          comparison = a.outstandingFees - b.outstandingFees;
          break;
        case 'feeCount':
          comparison = a.feeCount - b.feeCount;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    console.log('[ResidentsTable] Sorted', sorted.length, 'residents');
    return sorted;
  }, [residents, sortField, sortDirection]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get fee status badge
  const getFeeStatusBadge = (outstandingFees: number, unpaidCount: number) => {
    if (outstandingFees === 0) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300">
          No Fees
        </Badge>
      );
    }
    if (outstandingFees > 0 && unpaidCount > 0) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300">
          {unpaidCount} Unpaid ({formatCurrency(outstandingFees)})
        </Badge>
      );
    }
    return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Paid</Badge>;
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

  // Handle edit
  const handleEdit = (resident: ResidentWithFees) => {
    console.log('[ResidentsTable] Edit clicked for resident:', resident.id, resident.full_name);
    setSelectedResidentForEdit(resident);
  };

  // Handle delete
  const handleDelete = (resident: ResidentWithFees) => {
    console.log('[ResidentsTable] Delete clicked for resident:', resident.id, resident.full_name);
    setSelectedResidentForDelete(resident);
  };

  // Handle edit success
  const handleEditSuccess = (updatedResident: ResidentWithFees) => {
    console.log('[ResidentsTable] Resident updated successfully:', updatedResident.id, updatedResident.full_name);
    onEdit(updatedResident);
    setSelectedResidentForEdit(null);
  };

  // Handle delete success
  const handleDeleteSuccess = () => {
    if (selectedResidentForDelete) {
      console.log('[ResidentsTable] Resident deleted successfully:', selectedResidentForDelete.id, selectedResidentForDelete.full_name);
      onDelete(selectedResidentForDelete.id);
      setSelectedResidentForDelete(null);
    }
  };

  // Handle add fee
  const handleAddFee = (resident: ResidentWithFees) => {
    console.log('[ResidentsTable] Add fee clicked for resident:', resident.id, resident.full_name);
    setSelectedResidentForFee(resident.id);
  };

  if (loading) {
    console.log('[ResidentsTable] Rendering loading state');
    return (
      <Card className="p-6 border shadow-sm" role="status" aria-label="Loading residents">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" aria-hidden="true"></div>
          ))}
        </div>
      </Card>
    );
  }

  if (residents.length === 0) {
    console.log('[ResidentsTable] Rendering empty state');
    return (
      <Card className="p-12 text-center border shadow-sm" role="status">
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No residents found</h3>
          <p className="text-muted-foreground mb-4" aria-live="polite">
            Get started by adding your first resident to the building.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-2 py-1 -ml-2"
                    aria-label="Sort by name"
                    aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Name
                    {getSortIcon('name')}
                  </button>
                </TableHead>
                <TableHead className="font-semibold">
                  <button
                    onClick={() => handleSort('apartment')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-2 py-1 -ml-2"
                    aria-label="Sort by apartment number"
                    aria-sort={sortField === 'apartment' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Apartment
                    {getSortIcon('apartment')}
                  </button>
                </TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">
                  <button
                    onClick={() => handleSort('outstandingFees')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-2 py-1 -ml-2"
                    aria-label="Sort by outstanding fees"
                    aria-sort={sortField === 'outstandingFees' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Outstanding Fees
                    {getSortIcon('outstandingFees')}
                  </button>
                </TableHead>
                <TableHead className="font-semibold">
                  <button
                    onClick={() => handleSort('feeCount')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-2 py-1 -ml-2"
                    aria-label="Sort by total fee count"
                    aria-sort={sortField === 'feeCount' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Total Fees
                    {getSortIcon('feeCount')}
                  </button>
                </TableHead>
                <TableHead className="font-semibold">Residence</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResidents.map((resident) => (
                <TableRow key={resident.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{resident.full_name}</TableCell>
                  <TableCell>
                    {resident.apartment_number ? (
                      <Badge variant="outline" className="font-normal">
                        {resident.apartment_number}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm" aria-label="Not available">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={resident.role === 'syndic' ? 'default' : resident.role === 'guard' ? 'secondary' : 'outline'}
                      className="font-normal"
                    >
                      {resident.role === 'syndic' ? 'Syndic' : resident.role === 'guard' ? 'Guard' : 'Resident'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {resident.email ? (
                      <a
                        href={`mailto:${resident.email}`}
                        className="hover:text-primary hover:underline transition-colors"
                        aria-label={`Email ${resident.full_name} at ${resident.email}`}
                      >
                        {resident.email}
                      </a>
                    ) : (
                      <span className="text-sm" aria-label="Not available">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {resident.phone_number ? (
                      <a
                        href={`tel:${resident.phone_number}`}
                        className="hover:text-primary hover:underline transition-colors"
                        aria-label={`Call ${resident.full_name} at ${resident.phone_number}`}
                      >
                        {resident.phone_number}
                      </a>
                    ) : (
                      <span className="text-sm" aria-label="Not available">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getFeeStatusBadge(resident.outstandingFees, resident.unpaidFeeCount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal" aria-label={`${resident.feeCount} total fees`}>
                      {resident.feeCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {resident.residences?.name || <span className="text-sm" aria-label="Not available">N/A</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddFee(resident)}
                        aria-label={`Add fee for ${resident.full_name}`}
                        className="h-8 focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <DollarSign className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Add Fee</span>
                        <span className="sm:hidden">Fee</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Actions for ${resident.full_name}`}
                            className="h-8 w-8 p-0 focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">More actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleEdit(resident)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Resident
                          </DropdownMenuItem>
                          {/* Only show delete option if:
                              1. Resident is not a syndic, OR
                              2. Resident is a syndic but it's the current user's own account */}
                          {(resident.role !== 'syndic' || resident.id === currentUserId) && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(resident)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {resident.role === 'syndic' && resident.id === currentUserId
                                ? 'Delete My Account'
                                : 'Delete Resident'}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add Fee Dialog */}
      {selectedResidentForFee && (
        <AddFeeDialog
          open={!!selectedResidentForFee}
          residentId={selectedResidentForFee}
          onClose={() => {
            console.log('[ResidentsTable] Add fee dialog closed');
            setSelectedResidentForFee(null);
          }}
          onSuccess={(fee) => {
            console.log('[ResidentsTable] Fee added successfully:', fee.id, fee.title);
            onAddFee(fee);
            setSelectedResidentForFee(null);
          }}
        />
      )}

      {/* Edit Resident Dialog */}
      {selectedResidentForEdit && (
        <EditResidentDialog
          open={!!selectedResidentForEdit}
          resident={selectedResidentForEdit}
          onClose={() => {
            console.log('[ResidentsTable] Edit dialog closed');
            setSelectedResidentForEdit(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Resident Dialog */}
      {selectedResidentForDelete && (
        <DeleteResidentDialog
          open={!!selectedResidentForDelete}
          resident={{
            id: selectedResidentForDelete.id,
            full_name: selectedResidentForDelete.full_name,
            role: selectedResidentForDelete.role,
          }}
          onClose={() => {
            console.log('[ResidentsTable] Delete dialog closed');
            setSelectedResidentForDelete(null);
          }}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </>
  );
}
