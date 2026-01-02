'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CreateExpenseDTO, ExpenseCategory } from '@/types/financial.types';

interface CreateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  residenceId: number;
  categories: ExpenseCategory[];
}

export default function CreateExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
  residenceId,
  categories,
}: CreateExpenseDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateExpenseDTO>({
    residence_id: residenceId,
    title: '',
    description: '',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    category_id: undefined,
    vendor_name: '',
    vendor_contact: '',
    invoice_number: '',
  });

  const handleSubmit = async () => {
    // Validation
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (formData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Expense created successfully!');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to create expense');
      }
    } catch (error: any) {
      console.error('Error creating expense:', error);
      toast.error('Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Record a new expense for your residence
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Plumbing Repair"
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the expense"
              className="mt-2"
              rows={3}
            />
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="expense_date">Expense Date *</Label>
              <Input
                id="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category_id?.toString() || ''}
              onValueChange={(value) => setFormData({ ...formData, category_id: value ? parseInt(value) : undefined })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendor Information */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm">Vendor Information (Optional)</h4>
            
            <div>
              <Label htmlFor="vendor_name">Vendor Name</Label>
              <Input
                id="vendor_name"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                placeholder="Company or person name"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="vendor_contact">Vendor Contact</Label>
              <Input
                id="vendor_contact"
                value={formData.vendor_contact}
                onChange={(e) => setFormData({ ...formData, vendor_contact: e.target.value })}
                placeholder="Phone or email"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="INV-12345"
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Expense'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

