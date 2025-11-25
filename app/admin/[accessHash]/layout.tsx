import { ReactNode } from 'react'

// This layout bypasses the parent admin layout authentication check
// because this is the login page itself
export default function AdminLoginLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}

