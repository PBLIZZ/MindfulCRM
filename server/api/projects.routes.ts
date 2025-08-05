import { Router } from 'express';
import { projectService } from '../services/project.service.js';
import { requireAuth } from '../utils/jwt-auth.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';

const projectsRouter = Router();

// Middleware to apply to all project routes
projectsRouter.use(requireAuth);

// GET all projects for the logged-in user
projectsRouter.get('/', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const projects = await projectService.getProjects(req.user.id);
    res.json(projects);
  } catch (error: unknown) {
    logError('Get projects error', error);
    res.status(500).json(createErrorResponse('Failed to fetch projects', error, true));
  }
});

// POST a new project
projectsRouter.post('/', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const project = await projectService.createProject(req.user.id, req.body);
    res.status(201).json(project);
  } catch (error: unknown) {
    logError('Create project error', error);
    res.status(500).json(createErrorResponse('Failed to create project', error, true));
  }
});

// PATCH an existing project
projectsRouter.patch('/:id', async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.body);
    res.json(project);
  } catch (error: unknown) {
    logError('Update project error', error);
    res.status(500).json(createErrorResponse('Failed to update project', error, true));
  }
});

// DELETE (archive) a project
projectsRouter.delete('/:id', async (req, res) => {
  try {
    const success = await projectService.deleteProject(req.params.id);
    res.json({ success });
  } catch (error: unknown) {
    logError('Delete project error', error);
    res.status(500).json(createErrorResponse('Failed to delete project', error, true));
  }
});

export default projectsRouter;
