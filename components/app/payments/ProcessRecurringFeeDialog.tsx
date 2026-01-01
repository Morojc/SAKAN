'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, X, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getFeesForRule, markRecurringFeePaid, generateFeesForCurrentPeriod } from '@/app/actions/recurring-fees';
import toast from 'react-hot-toast';

interface ProcessRecurringFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setting: any;
  onSuccess: () => void;
}

export default function ProcessRecurringFeeDialog({
  open,
  onOpenChange,
  setting,
  onSuccess,
}: ProcessRecurringFeeDialogProps) {
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [fees, setFees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchFees = async () => {
    if (!setting?.id) return;
    setLoading(true);
    try {
      const result = await getFeesForRule(setting.id);
      if (result.data) {
        setFees(result.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFees();
    }
  }, [open, setting]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateFeesForCurrentPeriod(setting.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Generated fees for ${result.count} residents`);
        fetchFees();
      }
    } catch (error) {
      toast.error('Failed to generate fees');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (feeId: number) => {
    setProcessingId(feeId);
    try {
      const result = await markRecurringFeePaid(feeId, 'cash'); // Default to cash for easy UI
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Fee marked as paid and invoice sent');
        fetchFees();
        onSuccess();
      }
    } catch (error) {
      toast.error('Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredFees = fees.filter((fee) => {
    const matchesSearch =
      fee.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fee.profiles?.apartment_number?.toLowerCase().includes(searchTerm.toLowerCase()); // assuming profile has apt number linked or fetched
    // Wait, getFeesForRule fetches profiles(full_name, email). It doesn't fetch apartment number directly in the join unless we modify the query.
    // The previous action `getFeesForRule` fetched: `profiles:user_id (full_name, email, phone_number)`.
    // It did NOT fetch apartment number.
    // However, the `fees` table doesn't have apartment number. `profile_residences` does.
    // Ideally we should display apartment number.
    // For now, let's search by name.
    
    const matchesStatus =
      statusFilter === 'all' || fee.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{setting?.title} - Collection</DialogTitle>
          <DialogDescription>
            Manage payments for the current period due on {setting?.next_due_date ? new Date(setting.next_due_date).toLocaleDateString() : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between items-center my-4">
          <div className="flex gap-2 items-center flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resident..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating || loading}>
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Fees for Period
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredFees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No fees found for this period. Click "Generate Fees" to start.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell>
                      <div className="font-medium">{fee.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{fee.profiles?.email}</div>
                    </TableCell>
                    <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>{fee.amount} MAD</TableCell>
                    <TableCell>
                      <Badge variant={fee.status === 'paid' ? 'default' : 'destructive'}>
                        {fee.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {fee.status === 'paid' ? (
                        <Button variant="ghost" size="sm" disabled>
                          <Check className="mr-2 h-4 w-4" /> Paid
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          onClick={() => handleMarkPaid(fee.id)}
                          disabled={processingId === fee.id}
                        >
                          {processingId === fee.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

