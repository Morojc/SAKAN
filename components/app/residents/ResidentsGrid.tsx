'use client';

import { useState } from 'react';
import { Edit, Trash2, DollarSign, Mail, Phone, User, Building2, MoreVertical, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { ResidentWithFees, Fee } from './ResidentsContent';
import AddFeeDialog from './AddFeeDialog';
import EditResidentDialog from './EditResidentDialog';
import DeleteResidentDialog from './DeleteResidentDialog';
import { motion } from 'framer-motion';

interface ResidentsGridProps {
  residents: ResidentWithFees[];
  onEdit: (resident: ResidentWithFees) => void;
  onDelete: (residentId: string) => void;
  onAddFee: (fee: Fee) => void;
  onUpdateFee?: (fee: Fee) => void;
  loading?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

/**
 * Residents Grid Component
 * Modern card-based view for residents with enhanced UX
 */
export default function ResidentsGrid({
  residents,
  onEdit,
  onDelete,
  onAddFee,
  loading,
}: ResidentsGridProps) {
  console.log('[ResidentsGrid] Rendering with', residents.length, 'residents');

  const [selectedResidentForFee, setSelectedResidentForFee] = useState<string | null>(null);
  const [selectedResidentForEdit, setSelectedResidentForEdit] = useState<ResidentWithFees | null>(null);
  const [selectedResidentForDelete, setSelectedResidentForDelete] = useState<ResidentWithFees | null>(null);

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
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Up to date
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
        {unpaidCount} Pending
      </Badge>
    );
  };

  // Handle edit
  const handleEdit = (resident: ResidentWithFees) => {
    setSelectedResidentForEdit(resident);
  };

  // Handle delete
  const handleDelete = (resident: ResidentWithFees) => {
    setSelectedResidentForDelete(resident);
  };

  // Handle edit success
  const handleEditSuccess = (updatedResident: ResidentWithFees) => {
    onEdit(updatedResident);
    setSelectedResidentForEdit(null);
  };

  // Handle delete success
  const handleDeleteSuccess = () => {
    if (selectedResidentForDelete) {
      onDelete(selectedResidentForDelete.id);
      setSelectedResidentForDelete(null);
    }
  };

  // Handle add fee
  const handleAddFee = (resident: ResidentWithFees) => {
    setSelectedResidentForFee(resident.id);
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (residents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <User className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No residents found</h3>
        <p className="text-gray-500 max-w-sm mb-6">
          Get started by adding your first resident to the building management system.
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {residents.map((resident) => {
          const hasOutstandingFees = resident.outstandingFees > 0;
          const isSyndic = resident.role === 'syndic';

          return (
            <motion.div variants={item} key={resident.id}>
              <Card className={`
                group hover:shadow-lg transition-all duration-300 overflow-hidden relative
                ${isSyndic
                  ? 'border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent shadow-md shadow-primary/10'
                  : 'border-gray-200/60 bg-white'}
              `}>
                {/* Syndic Accent Bar */}
                {isSyndic && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
                )}

                {/* Syndic Left Border Accent */}
                {isSyndic && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/90 to-primary/70" />
                )}

                <CardContent className="p-0">
                  {/* Header Section */}
                  <div className={`p-5 border-b ${isSyndic ? 'border-primary/20 bg-primary/5' : 'border-gray-100 bg-gray-50/30'} relative`}>
                    {/* Syndic Crown Icon */}
                    {isSyndic && (
                      <div className="absolute top-3 right-3">
                        <div className="relative">
                          <Crown className="h-5 w-5 text-primary fill-primary/20" />
                          <div className="absolute inset-0 bg-primary/10 blur-sm rounded-full" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm relative
                          ${isSyndic
                            ? 'bg-gradient-to-br from-primary/20 to-primary/10 text-primary border-2 border-primary/30'
                            : hasOutstandingFees
                              ? 'bg-white text-orange-600 border border-orange-100'
                              : 'bg-white text-gray-700 border border-gray-200'}
                        `}>
                          {isSyndic && (
                            <Crown className="absolute -top-1 -right-1 h-4 w-4 text-primary fill-primary/30" />
                          )}
                          {resident.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold leading-tight transition-colors ${isSyndic
                                ? 'text-primary group-hover:text-primary/80'
                                : 'text-gray-900 group-hover:text-blue-600'
                              }`}>
                              {resident.full_name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {resident.apartment_number ? (
                              <div className="flex items-center text-xs text-gray-500 font-medium bg-white px-2 py-0.5 rounded-full border border-gray-200 w-fit shadow-sm">
                                <Building2 className="h-3 w-3 mr-1 text-gray-400" />
                                Apt. {resident.apartment_number}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No apartment</span>
                            )}
                            {resident.role === 'resident' && (
                              <Badge 
                                variant={resident.verified ? 'default' : 'secondary'}
                                className={`text-xs font-medium ${
                                  resident.verified 
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300' 
                                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300'
                                }`}
                              >
                                {resident.verified ? '✓ Verified' : '⚠ Pending'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-white">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(resident)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(resident)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {resident.role === 'syndic' && resident.id === currentUserId
                              ? 'Remove Resident'
                              : 'Delete Resident'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-5 space-y-5">
                    {/* Financial Status */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Financials</span>
                        {getFeeStatusBadge(resident.outstandingFees, resident.unpaidFeeCount)}
                      </div>
                      <div className={`p-3 rounded-xl flex items-center justify-between ${isSyndic
                          ? 'bg-primary/5 border border-primary/20'
                          : 'bg-gray-50 border border-gray-100'
                        }`}>
                        <div>
                          <p className={`text-xs mb-0.5 ${isSyndic ? 'text-primary/70' : 'text-gray-500'}`}>Total Due</p>
                          <p className={`text-lg font-bold ${hasOutstandingFees ? 'text-orange-600' : isSyndic ? 'text-primary' : 'text-gray-900'}`}>
                            {formatCurrency(resident.outstandingFees)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs mb-0.5 ${isSyndic ? 'text-primary/70' : 'text-gray-500'}`}>Fees</p>
                          <p className={`text-sm font-medium ${isSyndic ? 'text-primary' : 'text-gray-900'}`}>{resident.feeCount} Total</p>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2">
                      {resident.email && (
                        <a
                          href={`mailto:${resident.email}`}
                          className="flex items-center gap-3 text-sm text-gray-600 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50 group/link"
                        >
                          <Mail className="h-4 w-4 text-gray-400 group-hover/link:text-blue-500" />
                          <span className="truncate">{resident.email}</span>
                        </a>
                      )}
                      {resident.phone_number && (
                        <a
                          href={`tel:${resident.phone_number}`}
                          className="flex items-center gap-3 text-sm text-gray-600 hover:text-green-600 transition-colors p-2 rounded-lg hover:bg-green-50 group/link"
                        >
                          <Phone className="h-4 w-4 text-gray-400 group-hover/link:text-green-500" />
                          <span className="truncate">{resident.phone_number}</span>
                        </a>
                      )}
                    </div>

                    {/* Action Button */}
                    <Button
                      className={`w-full shadow-lg transition-all font-semibold ${'bg-gray-900 hover:bg-gray-800 text-white shadow-gray-900/10' }`}
                      onClick={() => handleAddFee(resident)}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Add Fee
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Dialogs */}
      {selectedResidentForFee && (
        <AddFeeDialog
          open={!!selectedResidentForFee}
          residentId={selectedResidentForFee}
          onClose={() => setSelectedResidentForFee(null)}
          onSuccess={(fee) => {
            onAddFee(fee);
            setSelectedResidentForFee(null);
          }}
        />
      )}

      {selectedResidentForEdit && (
        <EditResidentDialog
          open={!!selectedResidentForEdit}
          resident={selectedResidentForEdit}
          onClose={() => setSelectedResidentForEdit(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {selectedResidentForDelete && (
        <DeleteResidentDialog
          open={!!selectedResidentForDelete}
          resident={{
            id: selectedResidentForDelete.id,
            full_name: selectedResidentForDelete.full_name,
            role: selectedResidentForDelete.role,
          }}
          currentUserId={currentUserId}
          onClose={() => setSelectedResidentForDelete(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </>
  );
}