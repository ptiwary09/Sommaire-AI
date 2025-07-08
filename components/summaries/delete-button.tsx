'use client';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteSummaryAction } from '@/actions/summary-action';
import { toast } from 'sonner';
import { useUser } from '@clerk/nextjs';

interface DeleteButtonProps {
  summaryId: string;
}

export default function DeleteButton({ summaryId }: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useUser();

  console.log("DeleteButton props:", { summaryId });
  console.log("Logged-in Clerk user:", user);
  
  const userId = user?.id;
  const handleDelete = async () => {
    console.log("Starting delete process:", { summaryId, userId });
    
    if (!userId) {
      toast.error("Not logged in");
      return;
    }

    if (!summaryId) {
      toast.error("No summary ID provided");
      console.error("summaryId is missing:", summaryId);
      return;
    }

    setIsDeleting(true);
    
    try {
      const result = await deleteSummaryAction({ summaryId, userId });

      console.log("Delete result:", result);

      if (!result.success) {
        toast.error('Failed to delete summary', {
          description: result.error || 'Something went wrong while deleting.',
        });
      } else {
        toast.success('Summary deleted');
        setOpen(false);
        // Optionally trigger a page refresh or state update
        window.location.reload(); // You can replace this with a more elegant solution
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error('Failed to delete summary', {
        description: 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 bg-gray-50 border border-gray-200 hover:text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Summary</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this summary? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="ghost"
            className="bg-gray-50 border border-gray-200 hover:text-gray-600 hover:bg-gray-100"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="bg-gray-900 hover:bg-gray-600"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}