'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Eye, DollarSign } from 'lucide-react';
import type { ContributionStatusMatrix } from '@/types/financial.types';
import type { ContributionStatus } from '@/types/financial.types';

interface ApartmentContributionCardProps {
  apartment: ContributionStatusMatrix;
  columnHeaders: Array<{ key: string; label: string }>;
  userRole: string | null;
  onViewDetails?: () => void;
  onRecordPayment?: () => void;
  onDeleteContribution?: (contributionId: number, e: React.MouseEvent) => void;
}

export default function ApartmentContributionCard({
  apartment,
  columnHeaders,
  userRole,
  onViewDetails,
  onRecordPayment,
  onDeleteContribution,
}: ApartmentContributionCardProps) {
  const getStatusColor = (status: ContributionStatus | null) => {
    if (status === 'paid') return 'bg-green-500 text-white';
    if (status === 'partial') return 'bg-yellow-500 text-white';
    if (status === 'pending' || status === 'overdue') return 'bg-red-500 text-white';
    return 'bg-gray-200 text-gray-500';
  };

  const getStatusIcon = (status: ContributionStatus | null) => {
    if (status === 'paid') return '✓';
    if (status === 'partial') return '½';
    if (status === 'pending' || status === 'overdue') return '!';
    return '-';
  };

  const getStatusTooltip = (status: ContributionStatus | null, label: string) => {
    if (status === 'paid') return `Paid - ${label}`;
    if (status === 'partial') return `Partially paid - ${label}`;
    if (status === 'pending') return `Pending - ${label}`;
    if (status === 'overdue') return `Overdue - ${label}`;
    return `No contribution - ${label}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">Apartment {apartment.apartment_number}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{apartment.resident_name}</p>
          </div>
          {apartment.outstanding_months > 0 && (
            <Badge variant="destructive" className="ml-2">
              {apartment.outstanding_months.toString().padStart(2, '0')} Mois
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Timeline Visualization */}
          <div className="space-y-2">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {columnHeaders.map((col) => {
                const status = apartment.months[col.key] || null;
                const contributionId = apartment.contribution_ids?.[col.key];
                const statusColor = getStatusColor(status);
                const statusIcon = getStatusIcon(status);
                const tooltip = getStatusTooltip(status, col.label);

                return (
                  <div
                    key={col.key}
                    className="flex flex-col items-center min-w-[50px] group relative"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer transition-all hover:scale-110 ${statusColor}`}
                      title={tooltip}
                    >
                      {statusIcon}
                    </div>
                    <span className="text-xs mt-1 text-center text-muted-foreground leading-tight whitespace-nowrap">
                      {col.label.includes('(') ? col.label.split(' ')[0] : col.label.length > 8 ? col.label.substring(0, 5) : col.label}
                    </span>
                    {contributionId && userRole === 'syndic' && status !== null && (
                      <button
                        onClick={(e) => onDeleteContribution?.(contributionId, e)}
                        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-opacity"
                        title="Delete contribution"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Due</p>
              <p className="text-lg font-semibold">{formatCurrency(apartment.total_due)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(apartment.total_paid)}</p>
            </div>
          </div>

          {/* Progress Bar */}
          {apartment.total_due > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payment Progress</span>
                <span>{Math.round((apartment.total_paid / apartment.total_due) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((apartment.total_paid / apartment.total_due) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {onViewDetails && (
              <Button variant="outline" size="sm" className="flex-1" onClick={onViewDetails}>
                <Eye className="w-4 h-4 mr-2" />
                Details
              </Button>
            )}
            {apartment.outstanding_months > 0 && onRecordPayment && (
              <Button size="sm" className="flex-1" onClick={onRecordPayment}>
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

