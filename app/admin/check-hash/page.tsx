import { createSupabaseAdminClient } from '@/lib/supabase/server'

export default async function CheckHashPage() {
  const supabase = createSupabaseAdminClient()
  
  // Get all admins with their hashes
  const { data: admins, error } = await supabase
    .from('admins')
    .select('id, email, access_hash, is_active')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Admin Access Hash Check</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-6">
            Error: {error.message}
          </div>
        )}

        {admins && admins.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded mb-6">
            No admins found. Please run the migration first.
          </div>
        )}

        {admins && admins.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Access Hash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Login URL</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admins.map((admin) => (
                  <tr key={admin.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {admin.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {admin.access_hash || 'NULL'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {admin.is_active ? (
                        <span className="text-green-600">✓ Active</span>
                      ) : (
                        <span className="text-red-600">✗ Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {admin.access_hash ? (
                        <a 
                          href={`/admin/${admin.access_hash}`}
                          className="text-indigo-600 hover:underline"
                          target="_blank"
                        >
                          /admin/{admin.access_hash}
                        </a>
                      ) : (
                        <span className="text-gray-400">No hash</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded">
          <h2 className="font-semibold text-blue-900 mb-2">Instructions:</h2>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            <li>Check if your admin has an access_hash</li>
            <li>If NULL, run the migration: <code className="bg-blue-100 px-1">npx supabase db push</code></li>
            <li>Click on the login URL to test access</li>
            <li>Share the URL with the admin (keep it private!)</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

