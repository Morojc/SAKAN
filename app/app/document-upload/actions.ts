'use server';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export interface DocumentUploadResult {
	success: boolean;
	error?: string;
	submissionId?: number;
	message?: string;
}

/**
 * Upload document to Supabase Storage and create submission record
 */
export async function uploadDocument(formData: FormData): Promise<DocumentUploadResult> {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return {
				success: false,
				error: 'Not authenticated',
			};
		}

		const file = formData.get('file') as File;
		const idCardFile = formData.get('idCard') as File | null;
		const documentType = formData.get('documentType') as string; // 'proces-verbal' or 'id-card'
		
		if (!file && !idCardFile) {
			return {
				success: false,
				error: 'No file provided',
			};
		}

		// Validate file type (PDF, images)
		const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
		
		if (file && !allowedTypes.includes(file.type)) {
			return {
				success: false,
				error: 'Invalid file type for procès verbal. Please upload a PDF or image file.',
			};
		}

		if (idCardFile && !allowedTypes.includes(idCardFile.type)) {
			return {
				success: false,
				error: 'Invalid file type for ID card. Please upload a PDF or image file.',
			};
		}

		// Validate file size (max 10MB)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file && file.size > maxSize) {
			return {
				success: false,
				error: 'Procès verbal file size too large. Maximum size is 10MB.',
			};
		}

		if (idCardFile && idCardFile.size > maxSize) {
			return {
				success: false,
				error: 'ID card file size too large. Maximum size is 10MB.',
			};
		}

		const supabase = createSupabaseAdminClient();

		// Get user profile to check email verification
		const { data: profile } = await supabase
			.from('profiles')
			.select('id, email_verified, role')
			.eq('id', session.user.id)
			.maybeSingle();

		if (!profile) {
			return {
				success: false,
				error: 'Profile not found',
			};
		}

		if (!profile.email_verified) {
			return {
				success: false,
				error: 'Email must be verified before uploading documents',
			};
		}

		if (profile.role !== 'syndic') {
			return {
				success: false,
				error: 'Only syndics can upload documents',
			};
		}

		// Check if there's an existing submission (pending or rejected) BEFORE uploading
		// This allows us to delete old files before uploading new ones
		const { data: existingSubmission } = await supabase
			.from('syndic_document_submissions')
			.select('id, status, document_url, id_card_url')
			.eq('user_id', session.user.id)
			.in('status', ['pending', 'rejected'])
			.order('submitted_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		// Delete old files from storage if replacing
		if (existingSubmission) {
			// Delete old procès verbal document
			if (existingSubmission.document_url && file) {
				try {
					const oldDocumentPath = existingSubmission.document_url.split('/syndic-documents/')[1];
					if (oldDocumentPath) {
						const { error: deleteError } = await supabase.storage
							.from('SAKAN')
							.remove([`syndic-documents/${oldDocumentPath}`]);
						
						if (deleteError) {
							console.error('[Document Upload] Error deleting old document:', deleteError);
							// Continue anyway - don't fail the upload if old file deletion fails
						} else {
							console.log('[Document Upload] Old document deleted successfully');
						}
					}
				} catch (error) {
					console.error('[Document Upload] Error deleting old document:', error);
					// Continue anyway
				}
			}

			// Delete old ID card document
			if (existingSubmission.id_card_url && idCardFile) {
				try {
					const oldIdCardPath = existingSubmission.id_card_url.split('/syndic-documents/')[1];
					if (oldIdCardPath) {
						const { error: deleteError } = await supabase.storage
							.from('SAKAN')
							.remove([`syndic-documents/${oldIdCardPath}`]);
						
						if (deleteError) {
							console.error('[Document Upload] Error deleting old ID card:', deleteError);
							// Continue anyway - don't fail the upload if old file deletion fails
						} else {
							console.log('[Document Upload] Old ID card deleted successfully');
						}
					}
				} catch (error) {
					console.error('[Document Upload] Error deleting old ID card:', error);
					// Continue anyway
				}
			}
		}

		// Upload procès verbal document
		let documentUrl: string | undefined;
		if (file) {
			const fileExt = file.name.split('.').pop();
			const fileName = `${session.user.id}/proces-verbal-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
			const filePath = `syndic-documents/${fileName}`;

			const arrayBuffer = await file.arrayBuffer();
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from('SAKAN')
				.upload(filePath, arrayBuffer, {
					contentType: file.type,
					upsert: false,
				});

			if (uploadError) {
				console.error('[Document Upload] Storage error:', uploadError);
				return {
					success: false,
					error: 'Failed to upload procès verbal. Please try again.',
				};
			}

			const { data: urlData } = supabase.storage
				.from('SAKAN')
				.getPublicUrl(filePath);

			documentUrl = urlData.publicUrl;
		}

		// Upload ID card document
		let idCardUrl: string | undefined;
		if (idCardFile) {
			const fileExt = idCardFile.name.split('.').pop();
			const fileName = `${session.user.id}/id-card-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
			const filePath = `syndic-documents/${fileName}`;

			const arrayBuffer = await idCardFile.arrayBuffer();
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from('SAKAN')
				.upload(filePath, arrayBuffer, {
					contentType: idCardFile.type,
					upsert: false,
				});

			if (uploadError) {
				console.error('[ID Card Upload] Storage error:', uploadError);
				return {
					success: false,
					error: 'Failed to upload ID card. Please try again.',
				};
			}

			const { data: urlData } = supabase.storage
				.from('SAKAN')
				.getPublicUrl(filePath);

			idCardUrl = urlData.publicUrl;
		}

		let submissionId: number;

		if (existingSubmission) {
			// Update existing submission (pending or rejected)
			// Old files have already been deleted from storage above
			const updateData: any = {
				submitted_at: new Date().toISOString(),
				status: 'pending',
				rejection_reason: null,
				reviewed_at: null,
				reviewed_by: null,
			};

			// Only update URLs if new files were uploaded
			if (documentUrl) {
				updateData.document_url = documentUrl;
			}
			if (idCardUrl) {
				updateData.id_card_url = idCardUrl;
			}

			const { data: updatedSubmission, error: updateError } = await supabase
				.from('syndic_document_submissions')
				.update(updateData)
				.eq('id', existingSubmission.id)
				.select('id')
				.single();

			if (updateError) {
				console.error('[Document Upload] Update error:', updateError);
				return {
					success: false,
					error: 'Failed to update submission. Please try again.',
				};
			}

			submissionId = updatedSubmission.id;
		} else {
			// Create new submission - both documents are required
			if (!documentUrl) {
				return {
					success: false,
					error: 'Procès verbal document is required.',
				};
			}

			if (!idCardUrl) {
				return {
					success: false,
					error: 'ID card document is required.',
				};
			}

			const { data: newSubmission, error: insertError } = await supabase
				.from('syndic_document_submissions')
				.insert({
					user_id: session.user.id,
					document_url: documentUrl,
					id_card_url: idCardUrl,
					status: 'pending',
				})
				.select('id')
				.single();

			if (insertError) {
				console.error('[Document Upload] Insert error:', insertError);
				return {
					success: false,
					error: 'Failed to create submission. Please try again.',
				};
			}

			submissionId = newSubmission.id;
		}

		return {
			success: true,
			submissionId,
			message: 'Document uploaded successfully. Waiting for admin review.',
		};
	} catch (error: any) {
		console.error('[Document Upload] Error:', error);
		
		// Check if error is related to body size limit
		if (error?.message?.includes('Body exceeded') || error?.message?.includes('bodysizelimit') || error?.statusCode === 413) {
			return {
				success: false,
				error: 'File size too large. The total size of all files must not exceed 20MB. Please compress your files or reduce their size and try again.',
			};
		}
		
		// Check for other specific error types
		if (error?.code === 'ENOENT' || error?.message?.includes('ENOENT')) {
			return {
				success: false,
				error: 'File not found. Please select the files again and try uploading.',
			};
		}
		
		if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
			return {
				success: false,
				error: 'Network error. Please check your internet connection and try again.',
			};
		}
		
		return {
			success: false,
			error: error.message || 'An error occurred while uploading. Please try again. If the problem persists, contact support.',
		};
	}
}

/**
 * Get current user's document submission status
 */
export async function getDocumentStatus() {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return {
				success: false,
				error: 'Not authenticated',
			};
		}

		const supabase = createSupabaseAdminClient();

		const { data: submission, error } = await supabase
			.from('syndic_document_submissions')
			.select('id, status, submitted_at, reviewed_at, rejection_reason, document_url, id_card_url')
			.eq('user_id', session.user.id)
			.order('submitted_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error) {
			console.error('[Document Status] Error:', error);
			return {
				success: false,
				error: 'Failed to fetch status',
			};
		}

		return {
			success: true,
			submission: submission || null,
		};
	} catch (error: any) {
		console.error('[Document Status] Error:', error);
		return {
			success: false,
			error: error.message || 'An error occurred',
		};
	}
}

/**
 * Cancel document submission - delete from database
 */
export async function cancelSubmission(): Promise<{ success: boolean; error?: string }> {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return {
				success: false,
				error: 'Not authenticated',
			};
		}

		const supabase = createSupabaseAdminClient();

		// Get the submission to delete storage files
		const { data: submission } = await supabase
			.from('syndic_document_submissions')
			.select('document_url, id_card_url')
			.eq('user_id', session.user.id)
			.in('status', ['pending', 'rejected'])
			.order('submitted_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		// Delete files from storage if they exist
		if (submission) {
			// Delete procès verbal document
			if (submission.document_url) {
				try {
					const documentPath = submission.document_url.split('/syndic-documents/')[1];
					if (documentPath) {
						const { error: storageError } = await supabase.storage
							.from('SAKAN')
							.remove([`syndic-documents/${documentPath}`]);
						
						if (storageError) {
							console.error('[Cancel Submission] Storage delete error for document:', storageError);
						}
					}
				} catch (error) {
					console.error('[Cancel Submission] Error deleting document from storage:', error);
				}
			}

			// Delete ID card document
			if (submission.id_card_url) {
				try {
					const idCardPath = submission.id_card_url.split('/syndic-documents/')[1];
					if (idCardPath) {
						const { error: storageError } = await supabase.storage
							.from('SAKAN')
							.remove([`syndic-documents/${idCardPath}`]);
						
						if (storageError) {
							console.error('[Cancel Submission] Storage delete error for ID card:', storageError);
						}
					}
				} catch (error) {
					console.error('[Cancel Submission] Error deleting ID card from storage:', error);
				}
			}

			// Delete the submission record
			const { error: deleteError } = await supabase
				.from('syndic_document_submissions')
				.delete()
				.eq('user_id', session.user.id)
				.in('status', ['pending', 'rejected']);

			if (deleteError) {
				console.error('[Cancel Submission] Delete error:', deleteError);
				return {
					success: false,
					error: 'Failed to cancel submission. Please try again.',
				};
			}
		}

		// Reset verification status in profile
		// This ensures the user must go through verification again
		const { error: profileUpdateError } = await supabase
			.from('profiles')
			.update({
				verified: false,
			})
			.eq('id', session.user.id);

		if (profileUpdateError) {
			console.error('[Cancel Submission] Profile update error:', profileUpdateError);
			// Don't fail the request if profile update fails, but log it
		}

		return {
			success: true,
		};
	} catch (error: any) {
		console.error('[Cancel Submission] Error:', error);
		return {
			success: false,
			error: error.message || 'An error occurred',
		};
	}
}

