'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserCog, AlertCircle, Loader2, Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Resident {
  id: string;
  full_name: string;
  apartment_number: string | null;
  email: string | null;
}

interface ReplacementResidentSelectProps {
  onSelect: (residentEmail: string) => void;
  onNoResidents: () => void; // Callback when no residents available
  onCancel: () => void;
}

export default function ReplacementResidentSelect({ onSelect, onNoResidents, onCancel }: ReplacementResidentSelectProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchResidents = async () => {
      try {
        const response = await fetch('/api/account/replacement-residents');
        if (!response.ok) {
          throw new Error('Failed to fetch residents');
        }
        const data = await response.json();
        setResidents(data.residents || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load residents. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchResidents();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Filter residents based on search query
  const filteredResidents = useMemo(() => {
    if (!searchQuery.trim()) return residents;
    
    const query = searchQuery.toLowerCase();
    return residents.filter(resident => 
      resident.full_name.toLowerCase().includes(query) ||
      resident.email?.toLowerCase().includes(query) ||
      resident.apartment_number?.toLowerCase().includes(query)
    );
  }, [residents, searchQuery]);

  const handleContinue = () => {
    const selectedResident = residents.find(r => r.id === selectedResidentId);
    if (selectedResident && selectedResident.email) {
      onSelect(selectedResident.email);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedResident = residents.find(r => r.id === selectedResidentId);

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          Select Replacement Resident
        </DialogTitle>
        <DialogDescription>
          Choose the resident who will take over your syndic responsibilities.
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading eligible residents...</span>
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : residents.length === 0 ? (
        <div className="space-y-4">
          <Alert className="bg-orange-50 text-orange-800 border-orange-200">
            <AlertCircle className="h-4 w-4 text-orange-800" />
            <AlertTitle>No Residents Found</AlertTitle>
            <AlertDescription className="mt-2">
              There are no other eligible residents in your building to transfer ownership to.
            </AlertDescription>
          </Alert>
          <Alert className="bg-red-50 text-red-800 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-800" />
            <AlertTitle>Account & Residence Deletion</AlertTitle>
            <AlertDescription className="mt-2">
              Since there are no residents to transfer your responsibilities to, your account and the entire residence will be permanently deleted. 
              All your data, including residence information, fees, payments, and all related records will be removed and cannot be recovered.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="resident-select">Select Resident</Label>
            
            <div className="relative" ref={dropdownRef}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(!isOpen);
                  if (!isOpen) {
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }
                }}
                className="w-full justify-between h-14 px-4 bg-white hover:bg-gray-50/80 border-gray-200 text-left font-normal"
              >
                {selectedResident ? (
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(selectedResident.full_name)}
                    </div>
                    <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                      <span className="truncate font-medium text-gray-900">{selectedResident.full_name}</span>
                      <span className="truncate text-xs text-gray-500">{selectedResident.email}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select a resident...</span>
                )}
                <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", isOpen && "rotate-180")} />
              </Button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[320px] overflow-hidden"
                  >
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          ref={inputRef}
                          placeholder="Search by name, email, or apartment..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 h-10"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    {/* Residents List */}
                    <div className="overflow-y-auto max-h-[240px]">
                      {filteredResidents.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No residents found matching "{searchQuery}"
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredResidents.map((resident) => (
                            <button
                              key={resident.id}
                              type="button"
                              onClick={() => {
                                setSelectedResidentId(resident.id);
                                setIsOpen(false);
                                setSearchQuery('');
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                                "hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                                selectedResidentId === resident.id && "bg-primary/5 border border-primary/20"
                              )}
                            >
                              <div className={cn(
                                "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                                selectedResidentId === resident.id 
                                  ? "bg-primary text-primary-foreground" 
                                  : "bg-gray-100 text-gray-600"
                              )}>
                                {getInitials(resident.full_name)}
                              </div>
                              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium truncate">{resident.full_name}</span>
                                  {resident.apartment_number && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium whitespace-nowrap">
                                      Apt {resident.apartment_number}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 truncate">{resident.email}</span>
                              </div>
                              {selectedResidentId === resident.id && (
                                <Check className="ml-auto h-4 w-4 text-primary shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {selectedResidentId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-blue-100 bg-blue-50/50 p-4"
            >
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <UserCog className="h-4 w-4 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-blue-900">Review Selection</h4>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    You are about to transfer syndic responsibilities to <span className="font-semibold">{residents.find(r => r.id === selectedResidentId)?.full_name}</span>.
                    They will receive an access code to claim this role.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {residents.length === 0 ? (
          <Button 
            onClick={onNoResidents}
            disabled={loading}
            variant="destructive"
          >
            Proceed with Account Deletion
          </Button>
        ) : (
          <Button 
            onClick={handleContinue} 
            disabled={!selectedResidentId || loading}
            className="min-w-[100px]"
          >
            Continue
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
