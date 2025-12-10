'use client';

import { useState, useEffect } from 'react';
import { Receipt, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Expense } from './ExpensesContent';
import { updateExpense, uploadExpenseAttachment } from '@/app/app/expenses/actions';
import toast from 'react-hot-toast';

interface EditExpenseDialogProps {
  open: boolean;
  expense: Expense | null;
  onClose: () => void;
  onSuccess: (expense: Expense) => void;
}

/**
 * Expense categories
 */
const EXPENSE_CATEGORIES = [
  'Electricity',
  'Cleaning',
  'Maintenance',
  'Security',
  'Insurance',
  'Water',
  'Internet',
  'Trash Collection',
  'Gardening',
  'Plumbing',
  'Electrical',
  'Elevator',
  'Other',
];

/**
 * Edit Expense Dialog Component
 * Form for editing existing expenses with validation and file upload
 */
export default function EditExpenseDialog({
  open,
  expense,
  onClose,
  onSuccess,
}: EditExpenseDialogProps) {
  console.log('[EditExpenseDialog] Dialog render - open:', open, 'expense:', expense?.id);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{
    description?: string;
    category?: string;
    amount?: string;
    expenseDate?: string;
  }>({});

  // Initialize form when expense changes
  useEffect(() => {
    if (expense && open) {
      setDescription(expense.description || '');
      setCategory(expense.category || '');
      setAmount(expense.amount?.toString() || '');
      setExpenseDate(expense.expense_date ? expense.expense_date.split('T')[0] : '');
      setExistingAttachmentUrl(expense.attachment_url || null);
      setAttachmentUrl(expense.attachment_url || null);
      setSelectedFile(null);
      setFilePreview(null);
      setErrors({});
    }
  }, [expense, open]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[EditExpenseDialog] File selected:', file.name);

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a PDF or image file.');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File size too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Upload file before submitting
  const handleUploadFile = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    setUploading(true);
    console.log('[EditExpenseDialog] Uploading file:', selectedFile.name);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await uploadExpenseAttachment(formData);

      if (result.success && result.url) {
        console.log('[EditExpenseDialog] File uploaded successfully:', result.url);
        return result.url;
      } else {
        toast.error(result.error || 'Failed to upload file');
        return null;
      }
    } catch (error: any) {
      console.error('[EditExpenseDialog] Error uploading file:', error);
      toast.error(error.message || 'Failed to upload file');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!category) {
      newErrors.category = 'Category is required';
    }

    if (!amount || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!expenseDate) {
      newErrors.expenseDate = 'Expense date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[EditExpenseDialog] Form submitted');

    if (!expense) {
      toast.error('No expense selected');
      return;
    }

    if (!validateForm()) {
      console.log('[EditExpenseDialog] Validation failed:', errors);
      return;
    }

    setSubmitting(true);

    try {
      // Upload new file first if selected
      let finalAttachmentUrl = attachmentUrl;
      if (selectedFile) {
        const uploadedUrl = await handleUploadFile();
        if (uploadedUrl) {
          finalAttachmentUrl = uploadedUrl;
        } else {
          // Keep existing attachment if upload fails
          console.warn('[EditExpenseDialog] File upload failed, keeping existing attachment');
          finalAttachmentUrl = existingAttachmentUrl;
        }
      }

      // Update expense
      const result = await updateExpense({
        id: expense.id,
        description: description.trim(),
        category,
        amount: Number(amount),
        expense_date: expenseDate,
        attachment_url: finalAttachmentUrl || undefined,
      });

      if (result.success && result.data) {
        console.log('[EditExpenseDialog] Expense updated successfully:', result.data);
        toast.success('Expense updated successfully');
        onSuccess(result.data as Expense);
        onClose();
      } else {
        console.error('[EditExpenseDialog] Error:', result.error);
        toast.error(result.error || 'Failed to update expense');
      }
    } catch (error: any) {
      console.error('[EditExpenseDialog] Error updating expense:', error);
      toast.error(error.message || 'Failed to update expense');
    } finally {
      setSubmitting(false);
    }
  };

  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Edit Expense
          </DialogTitle>
          <DialogDescription>
            Update expense information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="edit-expense-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit-expense-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) {
                  setErrors({ ...errors, description: undefined });
                }
              }}
              placeholder="Enter expense description..."
              rows={3}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'edit-expense-description-error' : undefined}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p id="edit-expense-description-error" className="text-sm text-destructive" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Category and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-expense-category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  if (errors.category) {
                    setErrors({ ...errors, category: undefined });
                  }
                }}
              >
                <SelectTrigger
                  id="edit-expense-category"
                  aria-invalid={!!errors.category}
                  className={errors.category ? 'border-destructive' : ''}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.category}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-expense-amount">
                Amount (MAD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-expense-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) {
                    setErrors({ ...errors, amount: undefined });
                  }
                }}
                placeholder="0.00"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'edit-expense-amount-error' : undefined}
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && (
                <p id="edit-expense-amount-error" className="text-sm text-destructive" role="alert">
                  {errors.amount}
                </p>
              )}
            </div>
          </div>

          {/* Expense Date */}
          <div className="grid gap-2">
            <Label htmlFor="edit-expense-date">
              Expense Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => {
                setExpenseDate(e.target.value);
                if (errors.expenseDate) {
                  setErrors({ ...errors, expenseDate: undefined });
                }
              }}
              aria-invalid={!!errors.expenseDate}
              aria-describedby={errors.expenseDate ? 'edit-expense-date-error' : undefined}
              className={errors.expenseDate ? 'border-destructive' : ''}
            />
            {errors.expenseDate && (
              <p id="edit-expense-date-error" className="text-sm text-destructive" role="alert">
                {errors.expenseDate}
              </p>
            )}
          </div>

          {/* File Upload */}
          <div className="grid gap-2">
            <Label htmlFor="edit-expense-attachment">Attachment</Label>
            {existingAttachmentUrl && !selectedFile && (
              <div className="mb-2 p-2 bg-gray-50 rounded border">
                <p className="text-sm text-muted-foreground mb-2">Current attachment:</p>
                <a
                  href={existingAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View current attachment
                </a>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Input
                id="edit-expense-attachment"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                      setAttachmentUrl(existingAttachmentUrl);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {filePreview && (
              <div className="mt-2">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="max-w-xs max-h-32 rounded border"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload PDF or image file to replace current attachment (max 10MB)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting || uploading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            >
              {(submitting || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Uploading...' : submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

