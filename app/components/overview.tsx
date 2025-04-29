import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Overview() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="rounded-lg border bg-background p-8">
        <h1 className="mb-2 text-lg font-semibold">
          Welcome to AI Chat!
        </h1>
        <p className="text-muted-foreground">
          Start a conversation by typing a message below.
        </p>
      </div>
    </div>
  );
}
