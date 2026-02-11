import { format, parseISO } from 'date-fns';
import { LevelingProposal } from '@/lib/resourceLeveling';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface LevelResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: LevelingProposal[];
  onApply: () => void;
}

export function LevelResourcesDialog({ open, onOpenChange, proposals, onApply }: LevelResourcesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Level Resources — Proposed Schedule Changes</AlertDialogTitle>
          <AlertDialogDescription>
            {proposals.length} task{proposals.length !== 1 ? 's' : ''} will be shifted to resolve over-allocation. Review the changes below.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="overflow-auto flex-1 -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-2 pr-3">Task</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Before</th>
                <th className="py-2 pr-3">After</th>
                <th className="py-2 text-right">Shift</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => (
                <tr key={p.taskId} className="border-b last:border-b-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">{p.taskTitle}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{p.ownerName}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground tabular-nums">
                    {format(parseISO(p.oldStart), 'MMM dd')} — {format(parseISO(p.oldEnd), 'MMM dd')}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-emerald-600 tabular-nums">
                    {format(parseISO(p.newStart), 'MMM dd')} — {format(parseISO(p.newEnd), 'MMM dd')}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-foreground">
                    +{p.shiftDays}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onApply}>Apply Changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
