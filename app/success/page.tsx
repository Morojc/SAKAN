import { redirect } from 'next/navigation';

export default function Success() {
	// Redirect to app immediately after payment success
	// No need to show "Payment Successful" message
	redirect('/app');
}

