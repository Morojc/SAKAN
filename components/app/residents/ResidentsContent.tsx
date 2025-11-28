'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Search, Plus, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResidentsTable from './ResidentsTable';
import ResidentsGrid from './ResidentsGrid';
import ResidentsViewToggle from './ResidentsViewToggle';
import AddResidentDialog from './AddResidentDialog';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

/**
 * Resident data structure with fees information
 */
export interface ResidentWithFees {
  id: string;
  full_name: string;
  apartment_number: string | null;
  phone_number: string | null;
  role: string;
  created_at: string;
  residence_id: number | null;
  email: string | null;
  fees: Fee[];
  outstandingFees: number;
  feeCount: number;
  unpaidFeeCount: number;
  residences?: {
    id: number;
    name: string;
    address: string;
  } | null;
}

/**
 * Fee data structure
 */
export interface Fee {
  id: number;
  user_id: string;
  title: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
}

interface ResidentsContentProps {
  initialResidents: ResidentWithFees[];
  initialFees: Fee[];
  currentUserId?: string;
  currentUserRole?: string;
  currentUserResidenceId?: number | null;
}

/**
 * Residents Content Component
 * Manages state for residents, fees, filters, and UI interactions
 */
export default function ResidentsContent({ 
  initialResidents, 
  initialFees,
  currentUserId,
  currentUserRole,
  currentUserResidenceId,
}: ResidentsContentProps) {
  console.log('[ResidentsContent] Component mounted with', initialResidents.length, 'residents');

  const router = useRouter();

  // State management
  const [residents, setResidents] = useState<ResidentWithFees[]>(initialResidents);
  const [fees, setFees] = useState<Fee[]>(initialFees);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Sync local state with server data when it refreshes
  useEffect(() => {
    console.log('[ResidentsContent] Syncing state with server data:', {
      initialResidentsCount: initialResidents.length,
      initialFeesCount: initialFees.length,
      currentResidentsCount: residents.length,
    });
    setResidents(initialResidents);
    setFees(initialFees);
  }, [initialResidents, initialFees]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('[ResidentsContent] State updated:', {
      residentsCount: residents.length,
      feesCount: fees.length,
      searchQuery,
      statusFilter,
      showAddDialog,
    });
  }, [residents.length, fees.length, searchQuery, statusFilter, showAddDialog]);

  // Filtered and sorted residents
  const filteredResidents = useMemo(() => {
    console.log('[ResidentsContent] Filtering residents...', {
      total: residents.length,
      searchQuery,
      statusFilter,
    });

    let filtered = [...residents];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (resident) =>
          resident.full_name.toLowerCase().includes(query) ||
          resident.apartment_number?.toLowerCase().includes(query) ||
          resident.email?.toLowerCase().includes(query) ||
          resident.phone_number?.toLowerCase().includes(query)
      );
      console.log('[ResidentsContent] After search filter:', filtered.length, 'residents');
    }

    // Status filter (based on outstanding fees)
    if (statusFilter !== 'all') {
      if (statusFilter === 'with-fees') {
        filtered = filtered.filter((r) => r.outstandingFees > 0);
      } else if (statusFilter === 'no-fees') {
        filtered = filtered.filter((r) => r.outstandingFees === 0);
      }
      console.log('[ResidentsContent] After status filter:', filtered.length, 'residents');
    }

    return filtered;
  }, [residents, searchQuery, statusFilter]);

  /**
   * Handle resident added
   */
  const handleResidentAdded = (newResident: ResidentWithFees) => {
    console.log('[ResidentsContent] New resident added:', newResident);
    // Add to local state immediately for instant UI update
    setResidents((prev) => [...prev, newResident]);
    setShowAddDialog(false);
    toast.success('Resident added successfully! Refreshing data...');
    
    // Refresh server data to ensure we have the latest information
    // This ensures fees and other related data are up to date
    setTimeout(() => {
      router.refresh();
    }, 500); // Small delay to allow toast to show
  };

  /**
   * Handle resident updated
   */
  const handleResidentUpdated = (updatedResident: ResidentWithFees) => {
    console.log('[ResidentsContent] Resident updated:', updatedResident);
    setResidents((prev) =>
      prev.map((r) => (r.id === updatedResident.id ? updatedResident : r))
    );
    toast.success('Resident updated successfully');
  };

  /**
   * Handle resident deleted
   */
  const handleResidentDeleted = (residentId: string) => {
    console.log('[ResidentsContent] Resident deleted:', residentId);
    setResidents((prev) => prev.filter((r) => r.id !== residentId));
    // Also remove related fees
    setFees((prev) => prev.filter((f) => f.user_id !== residentId));
    toast.success('Resident deleted successfully');
  };

  /**
   * Handle fee added
   */
  const handleFeeAdded = (newFee: Fee) => {
    console.log('[ResidentsContent] New fee added:', newFee);
    setFees((prev) => [...prev, newFee]);

    // Update resident's fee information
    setResidents((prev) =>
      prev.map((resident) => {
        if (resident.id === newFee.user_id) {
          const updatedFees = [...resident.fees, newFee];
          const outstandingFees = updatedFees
            .filter((f) => f.status === 'unpaid')
            .reduce((sum, f) => sum + Number(f.amount), 0);

          return {
            ...resident,
            fees: updatedFees,
            outstandingFees,
            feeCount: updatedFees.length,
            unpaidFeeCount: updatedFees.filter((f) => f.status === 'unpaid').length,
          };
        }
        return resident;
      })
    );

    toast.success('Fee added successfully');
  };

  /**
   * Handle fee updated
   */
  const handleFeeUpdated = (updatedFee: Fee) => {
    console.log('[ResidentsContent] Fee updated:', updatedFee);
    setFees((prev) =>
      prev.map((f) => (f.id === updatedFee.id ? updatedFee : f))
    );

    // Update resident's fee information
    setResidents((prev) =>
      prev.map((resident) => {
        if (resident.id === updatedFee.user_id) {
          const updatedFees = resident.fees.map((f) =>
            f.id === updatedFee.id ? updatedFee : f
          );
          const outstandingFees = updatedFees
            .filter((f) => f.status === 'unpaid')
            .reduce((sum, f) => sum + Number(f.amount), 0);

          return {
            ...resident,
            fees: updatedFees,
            outstandingFees,
            unpaidFeeCount: updatedFees.filter((f) => f.status === 'unpaid').length,
          };
        }
        return resident;
      })
    );

    toast.success('Fee updated successfully');
  };

  return (
    <div className="space-y-8 relative pb-20 px-1">
      {/* Header Section with Search, Filter, View Toggle, and Add Button */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 w-full sm:max-w-md group">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
            <Input
              placeholder="Search by name, apartment, email..."
              value={searchQuery}
              onChange={(e) => {
                console.log('[ResidentsContent] Search query changed:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 rounded-xl transition-all duration-200 h-11"
              aria-label="Search residents"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value: string) => {
                console.log('[ResidentsContent] Status filter changed:', value);
                setStatusFilter(value);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl bg-white border-gray-200" aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Residents</SelectItem>
                <SelectItem value="with-fees">With Outstanding Fees</SelectItem>
                <SelectItem value="no-fees">No Outstanding Fees</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 h-11">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'table' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                aria-label="Table view"
              >
                <TableIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Add Resident Button - Desktop */}
        <Button
          onClick={() => {
            console.log('[ResidentsContent] Add resident button clicked, current showAddDialog:', showAddDialog);
            setShowAddDialog(true);
            console.log('[ResidentsContent] Set showAddDialog to true');
          }}
          className="hidden lg:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-lg shadow-gray-900/20 transition-all hover:scale-105 h-11 rounded-xl px-6"
          aria-label="Add new resident"
        >
          <UserPlus className="h-4 w-4" />
          Add Resident
        </Button>
      </div>

      {/* Residents View (Grid or Table) */}
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {viewMode === 'grid' ? (
          <ResidentsGrid
            residents={filteredResidents}
            onEdit={handleResidentUpdated}
            onDelete={handleResidentDeleted}
            onAddFee={handleFeeAdded}
            onUpdateFee={handleFeeUpdated}
            loading={loading}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        ) : (
          <ResidentsTable
            residents={filteredResidents}
            onEdit={handleResidentUpdated}
            onDelete={handleResidentDeleted}
            onAddFee={handleFeeAdded}
            onUpdateFee={handleFeeUpdated}
            loading={loading}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        )}
      </motion.div>

      {/* Floating Action Button for Add Resident - Mobile */}
      <Button
        onClick={() => {
          console.log('[ResidentsContent] Add resident button clicked, current showAddDialog:', showAddDialog);
          setShowAddDialog(true);
          console.log('[ResidentsContent] Set showAddDialog to true');
        }}
        size="lg"
        className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 z-[100] bg-gray-900 hover:bg-gray-800 text-white border-0"
        aria-label="Add new resident"
      >
        <Plus className="h-6 w-6 text-white" />
        <span className="sr-only">Add Resident</span>
      </Button>

      {/* Add Resident Dialog */}
      <AddResidentDialog
        open={showAddDialog}
        onClose={() => {
          console.log('[ResidentsContent] Add dialog closed callback');
          setShowAddDialog(false);
        }}
        onSuccess={handleResidentAdded}
        currentUserRole={currentUserRole}
        currentUserResidenceId={currentUserResidenceId}
      />
    </div>
  );
}