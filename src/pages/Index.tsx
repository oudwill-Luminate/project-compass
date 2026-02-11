import { motion, AnimatePresence } from 'framer-motion';
import { ProjectProvider, useProject } from '@/context/ProjectContext';
import { Sidebar } from '@/components/Sidebar';
import { TableView } from '@/components/TableView';
import { TimelineView } from '@/components/TimelineView';
import { RiskRegistry } from '@/components/RiskRegistry';

function ProjectContent() {
  const { activeView } = useProject();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const Index = () => (
  <ProjectProvider>
    <ProjectContent />
  </ProjectProvider>
);

export default Index;
