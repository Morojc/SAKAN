'use client';

import { useState, useEffect } from 'react';
import { Eye, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { getRegistrationRequests, type RegistrationRequest } from '@/app/actions/registration-requests';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import RequestDetailDialog from './RequestDetailDialog';

interface RegistrationRequestsTableProps {
  statusFilter: string;
}

export default function RegistrationRequestsTable({ statusFilter }: RegistrationRequestsTableProps) {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  useEffect(() => {
    filterRequests();
  }, [requests, searchQuery]);

  const fetchRequests = async () => {
    setLoading(true);
    const result = await getRegistrationRequests(statusFilter);

    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setRequests(result.data);
    }
    setLoading(false);
  };

  const filterRequests = () => {
    if (!searchQuery.trim()) {
      setFilteredRequests(requests);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = requests.filter(
      (req) =>
        req.full_name.toLowerCase().includes(query) ||
        req.email.toLowerCase().includes(query) ||
        req.apartment_number.toLowerCase().includes(query)
    );
    setFilteredRequests(filtered);
  };

  const handleViewDetails = (request: RegistrationRequest) => {
    setSelectedRequest(request);
    setDialogOpen(true);
  };

  const handleRequestUpdated = () => {
    fetchRequests();
    setDialogOpen(false);
    setSelectedRequest(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by name, email, or apartment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <span className="text-sm text-gray-500">
          {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No registration requests found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Apartment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.full_name}</TableCell>
                  <TableCell className="text-sm text-gray-600">{request.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{request.apartment_number}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(request)}
                      className="gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedRequest && (
        <RequestDetailDialog
          request={selectedRequest}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onRequestUpdated={handleRequestUpdated}
        />
      )}
    </div>
  );
}

