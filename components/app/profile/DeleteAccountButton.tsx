'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeleteAccountButton() {
	const [showConfirm, setShowConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [confirmText, setConfirmText] = useState('');

	const handleDeleteAccount = async () => {
		if (confirmText !== 'DELETE') {
			toast.error('Please type "DELETE" to confirm');
			return;
		}

		setIsDeleting(true);

		try {
			const response = await fetch('/api/account/delete', {
				method: 'DELETE',
			});

			const data = await response.json();

			if (response.ok) {
				toast.success('Account deleted successfully');
				// Sign out the user
				await signOut({ callbackUrl: '/', redirect: true });
			} else {
				toast.error(data.error || 'Failed to delete account');
				setIsDeleting(false);
			}
		} catch (error: any) {
			console.error('Error deleting account:', error);
			toast.error('Failed to delete account. Please try again.');
			setIsDeleting(false);
		}
	};

	return (
		<div className="mt-8">
			{!showConfirm ? (
				<motion.button
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					onClick={() => setShowConfirm(true)}
					className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-medium text-sm"
				>
					Delete Account
				</motion.button>
			) : (
				<AnimatePresence>
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="bg-red-50 border-2 border-red-200 rounded-lg p-6 space-y-4"
					>
						<div className="flex items-start gap-3">
							<div className="flex-shrink-0">
								<svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
								</svg>
							</div>
							<div className="flex-1">
								<h3 className="text-lg font-bold text-red-900 mb-2">Delete Your Account</h3>
								<p className="text-sm text-red-800 mb-4">
									This action cannot be undone. This will permanently delete your account, 
									cancel any active subscriptions, and remove all of your data.
								</p>
								<div className="space-y-3">
									<div>
										<label className="block text-sm font-medium text-red-900 mb-2">
											Type <span className="font-mono bg-red-100 px-2 py-1 rounded">DELETE</span> to confirm:
										</label>
										<input
											type="text"
											value={confirmText}
											onChange={(e) => setConfirmText(e.target.value)}
											placeholder="Type DELETE to confirm"
											className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
											disabled={isDeleting}
										/>
									</div>
									<div className="flex gap-3">
										<button
											onClick={handleDeleteAccount}
											disabled={isDeleting || confirmText !== 'DELETE'}
											className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 font-medium text-sm"
										>
											{isDeleting ? (
												<span className="flex items-center gap-2">
													<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
														<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
														<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
													</svg>
													Deleting...
												</span>
											) : (
												'Yes, Delete My Account'
											)}
										</button>
										<button
											onClick={() => {
												setShowConfirm(false);
												setConfirmText('');
											}}
											disabled={isDeleting}
											className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800 rounded-lg transition-colors duration-200 font-medium text-sm"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				</AnimatePresence>
			)}
		</div>
	);
}

