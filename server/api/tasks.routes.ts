import { Router, type Request, type Response } from 'express';

import { taskService } from '../services/task.service.js';
import { requireAuth } from '../utils/jwt-auth.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  delegateTaskSchema,
  bulkCreateTaskSchema
} from '../schemas/task.schemas.js';

const tasksRouter = Router();

tasksRouter.use(requireAuth);

// GET tasks with optional filtering
tasksRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    // Validate query parameters
    const queryResult = taskQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ 
        error: 'Invalid query parameters', 
        details: queryResult.error.errors 
      });
    }
    
    const { status, project, owner: _owner } = queryResult.data;
    let tasks;

    if (project) {
      tasks = await taskService.getTasksByProjectId(project);
    } else {
      const statuses = status ? status.split(',') : undefined;
      tasks = await taskService.getTasks(req.user.id, statuses);
    }
    res.json(tasks);
  } catch (error: unknown) {
    logError('Get tasks error', error);
    res.status(500).json(createErrorResponse('Failed to fetch tasks', error, true));
  }
});

// GET task analytics
tasksRouter.get('/analytics', async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const analytics = await taskService.getTaskAnalytics(req.user.id);
    res.json(analytics);
  } catch (error: unknown) {
    logError('Get task analytics error', error);
    res.status(500).json(createErrorResponse('Failed to fetch task analytics', error, true));
  }
});

// GET a single task with details
tasksRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await taskService.getTaskDetails(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error: unknown) {
    logError('Get task error', error);
    res.status(500).json(createErrorResponse('Failed to fetch task', error, true));
  }
});

// POST a new task
tasksRouter.post('/', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Validate request body
    const bodyResult = createTaskSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        error: 'Invalid task data', 
        details: bodyResult.error.errors 
      });
    }
    
    const { dueDate, ...taskData } = bodyResult.data;
    const processedTaskData = {
      ...taskData,
      dueDate: dueDate ? new Date(dueDate) : undefined
    };
    
    const task = await taskService.createTask(req.user.id, processedTaskData);
    res.status(201).json(task);
  } catch (error: unknown) {
    logError('Create task error', error);
    res.status(500).json(createErrorResponse('Failed to create task', error, true));
  }
});

// POST to delegate a task to AI
tasksRouter.post('/delegate-to-ai', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Validate request body
    const bodyResult = delegateTaskSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        error: 'Invalid task delegation data', 
        details: bodyResult.error.errors 
      });
    }
    
    const { title, description, contactIds, priority, dueDate } = bodyResult.data;
    const task = await taskService.delegateTaskToAI(req.user.id, {
      title,
      description,
      contactIds,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    res.status(202).json({
      success: true,
      task,
      message: 'Task successfully delegated to AI assistant. Processing will begin shortly.',
    });
  } catch (error) {
    logError('Delegate task to AI error', error);
    res.status(500).json(createErrorResponse('Failed to delegate task to AI', error, true));
  }
});

// POST to bulk create tasks
tasksRouter.post('/bulk-create', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Validate request body
    const bodyResult = bulkCreateTaskSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        error: 'Invalid bulk task creation data', 
        details: bodyResult.error.errors 
      });
    }
    
    // Extract only the properties the service expects
    const { csvData: _csvData, fileName, mapping: _mapping } = bodyResult.data;
    const bulkTaskData = {
      title: `Bulk task from ${fileName}`,
      description: `Bulk task created from CSV file: ${fileName}`,
      contactIds: [], // Will be populated from CSV processing
      owner: 'ai_assistant' as const
    };
    
    const task = await taskService.bulkCreateTask(req.user.id, bulkTaskData);
    res.status(201).json({ success: true, task });
  } catch (error) {
    logError('Bulk create task error', error);
    res.status(500).json(createErrorResponse('Failed to create bulk task', error, true));
  }
});

// PATCH an existing task
tasksRouter.patch('/:id', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Validate request body
    const bodyResult = updateTaskSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        error: 'Invalid task update data', 
        details: bodyResult.error.errors 
      });
    }
    
    const { dueDate, ...updates } = bodyResult.data;
    const processedUpdates = {
      ...updates,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    };
    
    const task = await taskService.updateTask(req.user.id, req.params.id, processedUpdates);
    res.json(task);
  } catch (error: unknown) {
    logError('Update task error', error);
    res.status(500).json(createErrorResponse('Failed to update task', error, true));
  }
});

// DELETE a task
tasksRouter.delete('/:id', async (req, res) => {
  try {
    const success = await taskService.deleteTask(req.params.id);
    res.json({ success });
  } catch (error: unknown) {
    logError('Delete task error', error);
    res.status(500).json(createErrorResponse('Failed to delete task', error, true));
  }
});

export default tasksRouter;
