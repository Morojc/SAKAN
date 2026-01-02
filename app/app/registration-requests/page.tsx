'use client';

import { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RegistrationRequestsTable from '@/components/app/registration-requests/RegistrationRequestsTable';
import { getRequestStats } from '@/app/actions/registration-requests';

export default function RegistrationRequestsPage() {
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const result = await getRequestStats();
    if (result.data) {
      setStats(result.data);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <UserPlus className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">Registration Requests</h1>
        </div>
        <p className="text-gray-600">
          Review and approve new resident registration requests submitted via QR code
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {loading ? '...' : stats.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {loading ? '...' : stats.approved}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {loading ? '...' : stats.rejected}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.total}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="all">
                All ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({stats.pending})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({stats.approved})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({stats.rejected})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <RegistrationRequestsTable statusFilter="all" />
            </TabsContent>

            <TabsContent value="pending">
              <RegistrationRequestsTable statusFilter="pending" />
            </TabsContent>

            <TabsContent value="approved">
              <RegistrationRequestsTable statusFilter="approved" />
            </TabsContent>

            <TabsContent value="rejected">
              <RegistrationRequestsTable statusFilter="rejected" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

