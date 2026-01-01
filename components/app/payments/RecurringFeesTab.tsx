'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { getRecurringFeeSettings, RecurringFeeSetting } from '@/app/actions/recurring-fees';
import AddRecurringFeeDialog from './AddRecurringFeeDialog';
import ProcessRecurringFeeDialog from './ProcessRecurringFeeDialog';
import { useAuth } from '@/lib/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

export default function RecurringFeesTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RecurringFeeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<RecurringFeeSetting | null>(null);

  const fetchSettings = async () => {
    if (!user?.residenceId) return;
    setLoading(true);
    try {
      const result = await getRecurringFeeSettings(parseInt(user.residenceId));
      if (result.data) {
        setSettings(result.data);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load payment rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user?.residenceId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Payment Rules</h2>
          <p className="text-sm text-muted-foreground">
            Manage recurring fees and process mass payments.
          </p>
        </div>
        {settings.length === 0 && (
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Payment Rule
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : settings.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <RefreshCw className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground">No Payment Rules</h3>
            <p className="text-muted-foreground mb-4">
              Create a recurring fee rule (e.g. Monthly Syndic Fee) to get started.
            </p>
            <Button onClick={() => setShowAddDialog(true)}>Create Rule</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settings.map((setting) => (
            <Card key={setting.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{setting.title}</CardTitle>
                    <CardDescription className="capitalize">
                      {setting.frequency} Payment
                    </CardDescription>
                  </div>
                  <Badge variant={setting.is_active ? 'default' : 'secondary'}>
                    {setting.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{setting.amount} MAD</span>
                  <span className="text-muted-foreground">per resident</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Next Due: {new Date(setting.next_due_date).toLocaleDateString()}</span>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t">
                <Button 
                  className="w-full" 
                  onClick={() => setSelectedSetting(setting)}
                >
                  Process Payments
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AddRecurringFeeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          setShowAddDialog(false);
          fetchSettings();
        }}
      />

      {selectedSetting && (
        <ProcessRecurringFeeDialog
          open={!!selectedSetting}
          onOpenChange={(open) => !open && setSelectedSetting(null)}
          setting={selectedSetting}
          onSuccess={() => {
            // Maybe refresh stats?
          }}
        />
      )}
    </div>
  );
}

