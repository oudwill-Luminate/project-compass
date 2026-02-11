import { Project, Owner } from '@/types/project';
import { format, addDays } from 'date-fns';

const today = new Date();
const d = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd');

const owners: Owner[] = [
  { id: 'o1', name: 'Sarah Mitchell', color: '#0073EA' },
  { id: 'o2', name: 'Alex Kim', color: '#00C875' },
  { id: 'o3', name: 'Emma Lopez', color: '#A25DDC' },
  { id: 'o4', name: 'Mike Roberts', color: '#FDAB3D' },
  { id: 'o5', name: 'Chris Park', color: '#E2445C' },
];

export const mockProject: Project = {
  id: 'p1',
  name: 'Software Launch v2.0',
  contingencyPercent: 10,
  buckets: [
    {
      id: 'b1',
      name: 'Planning & Discovery',
      color: '#0073EA',
      tasks: [
        {
          id: 't1', title: 'Define Project Scope', status: 'done', priority: 'high',
          owner: owners[0], startDate: d(-20), endDate: d(-15),
          estimatedCost: 5000, actualCost: 4800, dependsOn: null, dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 1, riskProbability: 1,
        },
        {
          id: 't2', title: 'Stakeholder Interviews', status: 'done', priority: 'medium',
          owner: owners[1], startDate: d(-18), endDate: d(-12),
          estimatedCost: 3000, actualCost: 3200, dependsOn: null, dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 1, riskProbability: 1,
        },
        {
          id: 't3', title: 'Create Project Charter', status: 'working', priority: 'high',
          owner: owners[0], startDate: d(-10), endDate: d(-5),
          estimatedCost: 2000, actualCost: 1500, dependsOn: 't1', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 2, riskProbability: 2,
        },
        {
          id: 't4', title: 'Budget Approval', status: 'not-started', priority: 'critical',
          owner: owners[3], startDate: d(-3), endDate: d(0),
          estimatedCost: 1000, actualCost: 0, dependsOn: 't3', dependencyType: 'FS',
          flaggedAsRisk: true, riskImpact: 5, riskProbability: 2,
        },
      ],
    },
    {
      id: 'b2',
      name: 'Design & UX',
      color: '#A25DDC',
      tasks: [
        {
          id: 't5', title: 'User Research', status: 'done', priority: 'high',
          owner: owners[2], startDate: d(-15), endDate: d(-8),
          estimatedCost: 8000, actualCost: 7500, dependsOn: null, dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 1, riskProbability: 1,
        },
        {
          id: 't6', title: 'Wireframes', status: 'working', priority: 'medium',
          owner: owners[2], startDate: d(-5), endDate: d(3),
          estimatedCost: 6000, actualCost: 4000, dependsOn: 't5', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 2, riskProbability: 2,
        },
        {
          id: 't7', title: 'UI Design Mockups', status: 'not-started', priority: 'high',
          owner: owners[4], startDate: d(5), endDate: d(15),
          estimatedCost: 12000, actualCost: 0, dependsOn: 't6', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 3, riskProbability: 2,
        },
        {
          id: 't8', title: 'Design Review', status: 'not-started', priority: 'medium',
          owner: owners[0], startDate: d(16), endDate: d(18),
          estimatedCost: 2000, actualCost: 0, dependsOn: 't7', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 2, riskProbability: 1,
        },
      ],
    },
    {
      id: 'b3',
      name: 'Development',
      color: '#00C875',
      tasks: [
        {
          id: 't9', title: 'Frontend Development', status: 'not-started', priority: 'critical',
          owner: owners[1], startDate: d(20), endDate: d(40),
          estimatedCost: 25000, actualCost: 0, dependsOn: 't7', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 4, riskProbability: 2,
        },
        {
          id: 't10', title: 'Backend API', status: 'not-started', priority: 'critical',
          owner: owners[3], startDate: d(20), endDate: d(38),
          estimatedCost: 22000, actualCost: 0, dependsOn: 't4', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 4, riskProbability: 2,
        },
        {
          id: 't11', title: 'Database Setup', status: 'stuck', priority: 'high',
          owner: owners[1], startDate: d(15), endDate: d(22),
          estimatedCost: 5000, actualCost: 3000, dependsOn: null, dependencyType: 'FS',
          flaggedAsRisk: true, riskImpact: 4, riskProbability: 3,
        },
        {
          id: 't12', title: 'Integration Testing', status: 'not-started', priority: 'high',
          owner: owners[2], startDate: d(42), endDate: d(50),
          estimatedCost: 10000, actualCost: 0, dependsOn: 't9', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 3, riskProbability: 2,
        },
      ],
    },
    {
      id: 'b4',
      name: 'Launch & Marketing',
      color: '#FDAB3D',
      tasks: [
        {
          id: 't13', title: 'Marketing Website', status: 'working', priority: 'medium',
          owner: owners[4], startDate: d(30), endDate: d(45),
          estimatedCost: 8000, actualCost: 2000, dependsOn: null, dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 2, riskProbability: 2,
        },
        {
          id: 't14', title: 'Press Release', status: 'not-started', priority: 'low',
          owner: owners[0], startDate: d(48), endDate: d(52),
          estimatedCost: 3000, actualCost: 0, dependsOn: 't13', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 1, riskProbability: 1,
        },
        {
          id: 't15', title: 'Social Media Campaign', status: 'not-started', priority: 'medium',
          owner: owners[4], startDate: d(50), endDate: d(60),
          estimatedCost: 5000, actualCost: 0, dependsOn: null, dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 2, riskProbability: 2,
        },
        {
          id: 't16', title: 'Launch Event', status: 'not-started', priority: 'high',
          owner: owners[3], startDate: d(58), endDate: d(62),
          estimatedCost: 15000, actualCost: 0, dependsOn: 't14', dependencyType: 'FS',
          flaggedAsRisk: false, riskImpact: 3, riskProbability: 2,
        },
      ],
    },
  ],
};
