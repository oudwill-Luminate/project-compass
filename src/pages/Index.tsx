import { useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectProvider, useProject } from '@/context/ProjectContext';
import { Sidebar } from '@/components/Sidebar';
import { TableView } from '@/components/TableView';
import { TimelineView } from '@/components/TimelineView';
import { RiskRegistry } from '@/components/RiskRegistry';
import { ProjectSettings } from '@/components/ProjectSettings';
import { Loader2 } from 'lucide-react';

function ProjectContent() {
  const { activeView, loading } = useProject();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {activeView === 'table' && <TableView />}
        {activeView === 'timeline' && <TimelineView />}
        {activeView === 'risk' && <RiskRegistry />}
        {activeView === 'settings' && <ProjectSettings />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Index() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) return <Navigate to="/" replace />;

  return (
    <ProjectProvider projectId={projectId}>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <ProjectContent />
      </div>
    </ProjectProvider>
  );
}
