'use client';

import { useState, useEffect } from 'react';
import { Receipt, Loader2, Upload, X } from 'lucide-react';
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
import { createExpense, uploadExpenseAttachment } from '@/app/app/expenses/actions';
import toast from 'react-hot-toast';

interface AddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (expense: Expense) => void;
  currentUserResidenceId?: number | null;
  residenceName?: string;
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
 * Add Expense Dialog Component
 * Form for adding new expenses with validation and file upload
 */
export default function AddExpenseDialog({
  open,
  onClose,
  onSuccess,
  currentUserResidenceId,
  residenceName,
}: AddExpenseDialogProps) {
  console.log('[AddExpenseDialog] Dialog render - open:', open);

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

  // Validation errors
  const [errors, setErrors] = useState<{
    description?: string;
    category?: string;
    amount?: string;
    expenseDate?: string;
  }>({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Set default date to today
      const today = new Date().toISOString().split('T')[0];
      setExpenseDate(today);
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setDescription('');
    setCategory('');
    setAmount('');
    const today = new Date().toISOString().split('T')[0];
    setExpenseDate(today);
    setSelectedFile(null);
    setFilePreview(null);
    setAttachmentUrl(null);
    setErrors({});
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[AddExpenseDialog] File selected:', file.name);

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
    console.log('[AddExpenseDialog] Uploading file:', selectedFile.name);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await uploadExpenseAttachment(formData);

      if (result.success && result.url) {
        console.log('[AddExpenseDialog] File uploaded successfully:', result.url);
        return result.url;
      } else {
        toast.error(result.error || 'Failed to upload file');
        return null;
      }
    } catch (error: any) {
      console.error('[AddExpenseDialog] Error uploading file:', error);
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
    console.log('[AddExpenseDialog] Form submitted');

    if (!validateForm()) {
      console.log('[AddExpenseDialog] Validation failed:', errors);
      return;
    }

    if (!currentUserResidenceId) {
      toast.error('Residence ID is required');
      return;
    }

    setSubmitting(true);

    try {
      // Upload file first if selected
      let finalAttachmentUrl = attachmentUrl;
      if (selectedFile) {
        const uploadedUrl = await handleUploadFile();
        if (uploadedUrl) {
          finalAttachmentUrl = uploadedUrl;
        } else {
          // User can still submit without attachment if upload fails
          console.warn('[AddExpenseDialog] File upload failed, continuing without attachment');
        }
      }

      // Create expense
      const result = await createExpense({
        description: description.trim(),
        category,
        amount: Number(amount),
        expense_date: expenseDate,
        residence_id: currentUserResidenceId,
        attachment_url: finalAttachmentUrl || undefined,
      });

      if (result.success && result.data) {
        console.log('[AddExpenseDialog] Expense created successfully:', result.data);
        toast.success('Expense created successfully');
        onSuccess(result.data as Expense);
        resetForm();
        onClose();
      } else {
        console.error('[AddExpenseDialog] Error:', result.error);
        toast.error(result.error || 'Failed to create expense');
      }
    } catch (error: any) {
      console.error('[AddExpenseDialog] Error creating expense:', error);
      toast.error(error.message || 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Add New Expense
          </DialogTitle>
          <DialogDescription>
            Record a new expense for {residenceName || 'your residence'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="expense-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="expense-description"
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
              aria-describedby={errors.description ? 'expense-description-error' : undefined}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p id="expense-description-error" className="text-sm text-destructive" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Category and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="expense-category">
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
                  id="expense-category"
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
              <Label htmlFor="expense-amount">
                Amount (MAD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expense-amount"
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
                aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && (
                <p id="expense-amount-error" className="text-sm text-destructive" role="alert">
                  {errors.amount}
                </p>
              )}
            </div>
          </div>

          {/* Expense Date */}
          <div className="grid gap-2">
            <Label htmlFor="expense-date">
              Expense Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => {
                setExpenseDate(e.target.value);
                if (errors.expenseDate) {
                  setErrors({ ...errors, expenseDate: undefined });
                }
              }}
              aria-invalid={!!errors.expenseDate}
              aria-describedby={errors.expenseDate ? 'expense-date-error' : undefined}
              className={errors.expenseDate ? 'border-destructive' : ''}
            />
            {errors.expenseDate && (
              <p id="expense-date-error" className="text-sm text-destructive" role="alert">
                {errors.expenseDate}
              </p>
            )}
          </div>

          {/* File Upload */}
          <div className="grid gap-2">
            <Label htmlFor="expense-attachment">Attachment (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="expense-attachment"
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
                      setAttachmentUrl(null);
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
              Upload PDF or image file (max 10MB)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting || uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || uploading}>
              {(submitting || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Uploading...' : submitting ? 'Creating...' : 'Create Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

