import { LayoutGrid, GanttChart, AlertTriangle, Settings, Folder, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/context/ProjectContext';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'table' as const, label: 'Table View', icon: LayoutGrid },
  { id: 'timeline' as const, label: 'Timeline', icon: GanttChart },
  { id: 'risk' as const, label: 'Risk Registry', icon: AlertTriangle },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { project, activeView, setActiveView } = useProject();
  const navigate = useNavigate();

  return (
    <aside className="w-[260px] min-w-[260px] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border h-screen sticky top-0">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-5 pt-4 pb-2 text-[11px] font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>All Projects</span>
      </button>
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-md">
            <Folder className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm truncate">{project.name}</h1>
            <p className="text-[11px] text-sidebar-foreground/50">Project Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-2">
          Views
        </p>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative',
              activeView === item.id
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <item.icon className="w-[18px] h-[18px]" />
            <span>{item.label}</span>
            {activeView === item.id && (
              <motion.div
                layoutId="activeNav"
                className="absolute right-3 w-1.5 h-1.5 rounded-full bg-sidebar-primary"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/40 font-medium">
          Contingency: <span className="text-sidebar-foreground">{project.contingencyPercent}%</span>
        </p>
      </div>
    </aside>
  );
}
