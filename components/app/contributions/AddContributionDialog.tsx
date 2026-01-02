'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';

interface AddContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  residenceId: number;
  apartments: Array<{ number: string; residentName: string; residentId: string }>;
}

export default function AddContributionDialog({
  open,
  onOpenChange,
  onSuccess,
  residenceId,
  apartments,
}: AddContributionDialogProps) {
  const { t } = useI18n();
  const [selectedApartment, setSelectedApartment] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [totalApartments, setTotalApartments] = useState<number | null>(null);
  const [loadingTotal, setLoadingTotal] = useState(false);

  // Fetch total_apartments when dialog opens
  useEffect(() => {
    if (open && residenceId) {
      fetchTotalApartments();
    }
  }, [open, residenceId]);

  const fetchTotalApartments = async () => {
    setLoadingTotal(true);
    try {
      const response = await fetch(`/api/residences/${residenceId}/total-apartments`);
      if (response.ok) {
        const data = await response.json();
        setTotalApartments(data.total_apartments);
      } else {
        console.error('Failed to fetch total apartments');
      }
    } catch (error) {
      console.error('Error fetching total apartments:', error);
    } finally {
      setLoadingTotal(false);
    }
  };

  // Generate all apartment numbers from 1 to total_apartments
  const getAllApartmentNumbers = (): Array<{ number: string; residentName: string; residentId: string | null }> => {
    if (!totalApartments || totalApartments <= 0) {
      // Fallback to occupied apartments if total_apartments is not set
      return apartments;
    }

    const allApartments: Array<{ number: string; residentName: string; residentId: string | null }> = [];
    
    for (let i = 1; i <= totalApartments; i++) {
      const aptNumber = i.toString();
      const occupiedApartment = apartments.find(apt => apt.number === aptNumber);
      
      allApartments.push({
        number: aptNumber,
        residentName: occupiedApartment?.residentName || 'Vacant',
        residentId: occupiedApartment?.residentId || null,
      });
    }
    
    return allApartments;
  };

  const allApartmentOptions = getAllApartmentNumbers();

  const monthNames = [
    t('contributions.january'), t('contributions.february'), t('contributions.march'),
    t('contributions.april'), t('contributions.may'), t('contributions.june'),
    t('contributions.july'), t('contributions.august'), t('contributions.september'),
    t('contributions.october'), t('contributions.november'), t('contributions.december')
  ];

  const handleSubmit = async () => {
    // Validation
    if (!selectedApartment) {
      toast.error('Please select an apartment');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      const selectedApt = allApartmentOptions.find(apt => apt.number === selectedApartment);
      if (!selectedApt) {
        toast.error('Apartment not found');
        setSubmitting(false);
        return;
      }

      // If apartment is vacant (no residentId), we still allow adding contribution
      // The API will handle creating the fee record
      const response = await fetch('/api/contributions/add-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residenceId,
          userId: selectedApt.residentId || null, // Can be null for vacant apartments
          apartmentNumber: selectedApartment,
          month,
          year,
          amount: parseFloat(amount),
          status,
          paymentMethod: status === 'paid' ? paymentMethod : null,
          paymentDate: status === 'paid' ? paymentDate : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to add contribution');
        setSubmitting(false);
        return;
      }

      toast.success('Contribution added successfully!');
      
      // Reset form
      setSelectedApartment('');
      setMonth(new Date().getMonth() + 1);
      setYear(new Date().getFullYear());
      setAmount('');
      setStatus('unpaid');
      setPaymentMethod('cash');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      
      setSubmitting(false);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding contribution:', error);
      toast.error('Failed to add contribution');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('contributions.addContributionTitle')}</DialogTitle>
          <DialogDescription>
            {t('contributions.addContributionDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Apartment Selection */}
          <div>
            <Label htmlFor="apartment">{t('contributions.apartment')} *</Label>
            <Select value={selectedApartment} onValueChange={setSelectedApartment} disabled={loadingTotal}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={loadingTotal ? 'Loading...' : t('contributions.selectApartment')} />
              </SelectTrigger>
              <SelectContent>
                {allApartmentOptions.map((apt) => (
                  <SelectItem key={apt.number} value={apt.number}>
                    Apt {apt.number} {apt.residentId ? `- ${apt.residentName}` : `(${apt.residentName})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {totalApartments && (
              <p className="text-xs text-muted-foreground mt-1">
                Total apartments: {totalApartments}
              </p>
            )}
          </div>

          {/* Month & Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="month">{t('contributions.month')} *</Label>
              <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year">{t('contributions.year')} *</Label>
              <Input
                id="year"
                type="number"
                min={2020}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="mt-2"
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">{t('contributions.amount')} *</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 150"
              className="mt-2"
            />
          </div>

          {/* Payment Status */}
          <div>
            <Label htmlFor="status">{t('contributions.status')} *</Label>
            <Select value={status} onValueChange={(val: 'paid' | 'unpaid') => setStatus(val)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">{t('contributions.unpaid')}</SelectItem>
                <SelectItem value="paid">{t('contributions.paid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Details (only if paid) */}
          {status === 'paid' && (
            <>
              <div>
                <Label htmlFor="paymentMethod">{t('contributions.paymentMethod')}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={t('contributions.selectMethod')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('contributions.cash')}</SelectItem>
                    <SelectItem value="transfer">{t('contributions.bankTransfer')}</SelectItem>
                    <SelectItem value="check">{t('contributions.check')}</SelectItem>
                    <SelectItem value="card">{t('contributions.card')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paymentDate">{t('contributions.paymentDate')}</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-2"
                />
              </div>
            </>
          )}

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-medium text-blue-900 mb-2">{t('contributions.summary')}</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {t('contributions.summaryApartment')} {selectedApartment || 'Not selected'} {
                selectedApartment && (() => {
                  const selectedApt = allApartmentOptions.find(apt => apt.number === selectedApartment);
                  return selectedApt?.residentId ? `(${selectedApt.residentName})` : '(Vacant)';
                })()
              }</li>
              <li>• {t('contributions.summaryMonth')} {monthNames[month - 1]} {year}</li>
              <li>• {t('contributions.summaryAmount')} {amount ? `${amount} MAD` : 'Not set'}</li>
              <li>• {t('contributions.summaryStatus')} {status === 'paid' ? '✅ ' + t('contributions.paid') : '⏳ ' + t('contributions.unpaid')}</li>
              {status === 'paid' && (
                <>
                  <li>• {t('contributions.summaryMethod')} {paymentMethod}</li>
                  <li>• {t('contributions.summaryDate')} {paymentDate}</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('contributions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('contributions.adding')}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {t('contributions.addContribution')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

