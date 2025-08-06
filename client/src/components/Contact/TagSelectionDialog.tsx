import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Badge } from '@/components/ui/badge.js';
import { useToast } from '@/hooks/use-toast.js';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagErrorResponse {
  error: string;
  message?: string;
}

interface TagSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagSelected: (tag: { name: string; color: string }) => void;
  title: string;
  description: string;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6b7280', // gray
];

export function TagSelectionDialog({
  open,
  onOpenChange,
  onTagSelected,
  title,
  description,
}: TagSelectionDialogProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing tags
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch tags');
      return await response.json() as Tag[];
    },
  });

  // Create new tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagData: { name: string; color: string }) => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(tagData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create tag' })) as TagErrorResponse;
        const errorMessage = errorData.message ?? 'Failed to create tag';
        throw new Error(errorMessage);
      }

      return response.json() as Promise<Tag>;
    },
    onSuccess: async (newTag: Tag) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      onTagSelected(newTag);
      setIsCreatingNew(false);
      setNewTagName('');
      setSelectedColor(DEFAULT_COLORS[0]);
      onOpenChange(false);
      toast({
        title: 'Tag created',
        description: `Tag "${newTag.name}" has been created and selected.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating tag',
        description: error instanceof Error ? error.message : 'Failed to create new tag. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleExistingTagSelect = (tag: Tag) => {
    onTagSelected(tag);
    onOpenChange(false);
  };

  const handleCreateNewTag = () => {
    if (!newTagName.trim()) {
      toast({
        title: 'Tag name required',
        description: 'Please enter a name for the new tag.',
        variant: 'destructive',
      });
      return;
    }

    // Check if tag with same name already exists
    const existingTag = tags.find(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (existingTag) {
      toast({
        title: 'Tag already exists',
        description: `A tag with the name "${newTagName}" already exists.`,
        variant: 'destructive',
      });
      return;
    }

    createTagMutation.mutate({
      name: newTagName.trim(),
      color: selectedColor,
    });
  };

  const resetDialog = () => {
    setIsCreatingNew(false);
    setNewTagName('');
    setSelectedColor(DEFAULT_COLORS[0]);
  };

  // Reset dialog state when it closes
  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => {
        // Prevent auto-focus to avoid accessibility issues
        e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isCreatingNew ? (
            <>
              {/* Existing Tags */}
              <div className="space-y-3">
                <Label>Select an existing tag:</Label>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags available. Create a new one below.</p>
                  ) : (
                    tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleExistingTagSelect(tag)}
                        className="w-full p-2 text-left rounded-md border hover:bg-muted transition-colors"
                      >
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Create New Tag Button */}
              <Button
                variant="outline"
                onClick={() => setIsCreatingNew(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Tag
              </Button>
            </>
          ) : (
            <>
              {/* Create New Tag Form */}
              <div className="space-y-3">
                <Label htmlFor="tag-name">Tag Name</Label>
                <Input
                  id="tag-name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateNewTag();
                    }
                  }}
                />
              </div>

              <div className="space-y-3">
                <Label>Tag Color</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor === color
                          ? 'border-foreground scale-110'
                          : 'border-muted hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {/* Preview */}
                {newTagName && (
                  <div className="pt-2">
                    <Label className="text-sm text-muted-foreground">Preview:</Label>
                    <div className="mt-1">
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: selectedColor + '20',
                          color: selectedColor,
                          borderColor: selectedColor
                        }}
                      >
                        {newTagName}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {isCreatingNew ? (
            <>
              <Button variant="outline" onClick={() => setIsCreatingNew(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleCreateNewTag}
                disabled={createTagMutation.isPending || !newTagName.trim()}
              >
                <Check className="h-4 w-4 mr-2" />
                Create Tag
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
