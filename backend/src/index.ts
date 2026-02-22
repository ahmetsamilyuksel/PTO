import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import organizationRoutes from './routes/organizations';
import personRoutes from './routes/persons';
import locationRoutes from './routes/locations';
import workItemRoutes from './routes/workItems';
import materialRoutes from './routes/materials';
import documentRoutes from './routes/documents';
import templateRoutes from './routes/templates';
import journalRoutes from './routes/journals';
import workflowRoutes from './routes/workflow';
import packageRoutes from './routes/packages';
import matrixRoutes from './routes/matrix';
import attachmentRoutes from './routes/attachments';
import dashboardRoutes from './routes/dashboard';
import categoryRoutes from './routes/categories';
import customTemplateRoutes from './routes/customTemplates';
import taskRoutes from './routes/tasks';
import correctionRoutes from './routes/corrections';
import progressRoutes from './routes/progress';
import teamRoutes from './routes/team';
import adminRoutes from './routes/admin';
import { initMinIO } from './services/storage';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const app = express();

app.use(cors({
  origin: process.env.VERCEL === '1'
    ? [/wornetpto\.life$/, /\.vercel\.app$/, /^https?:\/\/pto[^.]*\.vercel\.app$/]
    : '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ status: 'ok', db: 'connected', system: config.systemName, env: process.env.NODE_ENV });
  } catch (error) {
    res.status(503).json({ status: 'error', db: 'disconnected', system: config.systemName, env: process.env.NODE_ENV });
  }
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api', authMiddleware);
app.use('/api', auditMiddleware);

app.use('/api/projects', projectRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/work-items', workItemRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/matrix', matrixRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/custom-templates', customTemplateRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/corrections', correctionRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/admin', adminRoutes);

// Export app for Vercel serverless
export default app;
export { app };

// Only start listening when running locally (not on Vercel)
if (!process.env.VERCEL) {
  async function main() {
    try {
      await prisma.$connect();
      console.log('Database connected');

      await initMinIO();
      console.log('MinIO initialized');

      app.listen(config.port, '0.0.0.0', () => {
        console.log(`${config.systemName} backend running on port ${config.port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  main();
}
