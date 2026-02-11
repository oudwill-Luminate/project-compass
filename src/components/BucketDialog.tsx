import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OwnerAvatar } from './OwnerAvatar';
import { Bucket } from '@/types/project';

const COLOR_PRESETS = [
  '#0073EA', '#00C875', '#A25DDC', '#FDAB3D',
  '#E2445C', '#579BFC', '#FF642E', '#CAB641',
  '#225091', '#BB3354', '#175A63', '#7F5347',
];

interface BucketDialogProps {
  bucket: Bucket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: { name?: string; color?: string; description?: string; owner_id?: string | null }) => void;
  members: { id: string; user_id: string; role: string; profile: { id: string; display_name: string; avatar_url: string | null } }[];
}

export function BucketDialog({ bucket, open, onOpenChange, onSave, members }: BucketDialogProps) {
  const [name, setName] = useState(bucket.name);
  const [color, setColor] = useState(bucket.color);
  const [description, setDescription] = useState(bucket.description || '');
  const [ownerId, setOwnerId] = useState<string | null>(bucket.ownerId || null);

  useEffect(() => {
    setName(bucket.name);
    setColor(bucket.color);
    setDescription(bucket.description || '');
    setOwnerId(bucket.ownerId || null);
  }, [bucket]);

  const handleSave = () => {
    onSave({
      name: name.trim() || bucket.name,
      color,
      description,
      owner_id: ownerId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bucket-name">Name</Label>
            <Input id="bucket-name" value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? 'hsl(var(--foreground))' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="bucket-desc">Description</Label>
            <Textarea
              id="bucket-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={3}
            />
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label>Owner / Lead</Label>
            <Select value={ownerId || 'none'} onValueChange={v => setOwnerId(v === 'none' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No owner</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profile.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
