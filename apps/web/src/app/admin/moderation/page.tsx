'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminModerationPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Moderation Queue</h1>
      <Card>
        <CardHeader>
          <CardTitle>Content Review</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Review flagged bios, avatars, and messages. Escalate critical items.
        </CardContent>
      </Card>
    </div>
  );
}