'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { callsApi } from '@/lib/api/calls';

export function CallConsentScreen({
  callId,
  onConsent,
  onCancel,
}: {
  callId: string;
  onConsent: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    setLoading(true);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        /* permission prompt may still appear during the call */
      }
      await callsApi.consent(callId, '1.0');
      onConsent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record consent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <CardTitle>Before you connect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ul className="list-disc space-y-2 pl-5">
            <li>This is a social conversation — keep it respectful</li>
            <li>No explicit, illegal, or harmful content</li>
            <li>Recording is prohibited</li>
            <li>You can report or end the call anytime</li>
            <li>Coins deduct automatically during paid calls</li>
          </ul>
          <Button className="w-full" onClick={accept} disabled={loading}>
            I agree — Start Call
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}