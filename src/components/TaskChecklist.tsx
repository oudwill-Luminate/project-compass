import { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  position: number;
}

interface TaskChecklistProps {
  taskId: string;
  isNew?: boolean;
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
}

export function TaskChecklist({ taskId, isNew, items, onItemsChange }: TaskChecklistProps) {
  const [newLabel, setNewLabel] = useState('');

  const addItem = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const position = items.length;

    if (isNew) {
      // For new tasks, just add to local state with a temp id
      const tempItem: ChecklistItem = { id: crypto.randomUUID(), label, checked: false, position };
      onItemsChange([...items, tempItem]);
      setNewLabel('');
      return;
    }

    const { data, error } = await supabase
      .from('checklist_items' as any)
      .insert({ task_id: taskId, label, position } as any)
      .select()
      .single();

    if (!error && data) {
      const d = data as any;
      onItemsChange([...items, { id: d.id, label: d.label, checked: d.checked, position: d.position }]);
    }
    setNewLabel('');
  };

  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newChecked = !item.checked;

    onItemsChange(items.map(i => i.id === id ? { ...i, checked: newChecked } : i));

    if (!isNew) {
      await supabase
        .from('checklist_items' as any)
        .update({ checked: newChecked } as any)
        .eq('id', id);
    }
  };

  const removeItem = async (id: string) => {
    onItemsChange(items.filter(i => i.id !== id));

    if (!isNew) {
      await supabase
        .from('checklist_items' as any)
        .delete()
        .eq('id', id);
    }
  };

  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div className="p-3 rounded-lg border space-y-3">
      <Label className="text-xs font-medium">
        Quality Checklist {items.length > 0 && `(${checkedCount}/${items.length})`}
      </Label>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 group">
              <Checkbox
                checked={item.checked}
                onCheckedChange={() => toggleItem(item.id)}
              />
              <span className={`text-xs flex-1 ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
              >
                <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Add checklist item..."
          className="text-xs h-8"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
        />
        <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!newLabel.trim()}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
