import { Router } from 'express';
import contactsRouter from './contacts.routes.js';
import projectsRouter from './projects.routes.js';
import tasksRouter from './tasks.routes.js';
import calendarRouter from './calendar.routes.js';
import aiRouter from './ai.routes.js';
import dashboardRouter from './dashboard.routes.js';
import interactionsRouter from './interactions.routes.js';
import tagsRouter from './tags.routes.js';
import miscRouter from './misc.routes.js';

const apiRouter = Router();

// Mount all the domain-specific routers
// Note: auth routes are mounted separately at root level
apiRouter.use('/misc', miscRouter); // For /sync/*, /emails/* etc.
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/contacts', contactsRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/calendar', calendarRouter);
apiRouter.use('/interactions', interactionsRouter); // For /interactions/*, /goals/*
apiRouter.use('/tags', tagsRouter);
apiRouter.use('/ai', aiRouter); // Must be last to catch all /ai/* routes

export default apiRouter;
