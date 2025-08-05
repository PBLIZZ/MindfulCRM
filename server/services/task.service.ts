import { storage } from '../data/index.js';
import { taskAI } from '../brains/task-ai.js';
import { type Task, type InsertTask, type TaskActivity } from '../../shared/schema.js';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting_approval';
type TaskOwner = 'user' | 'ai_assistant';

export class TaskService {
  async getTasks(userId: string, statuses?: string[]): Promise<Task[]> {
    return storage.tasks.getTasksByUserId(userId, statuses);
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return storage.tasks.getTasksByProjectId(projectId);
  }

  // NOTE: This now requires a new method in `task.data.ts` to filter by status AND owner.
  // Assuming `storage.tasks.getTasksByStatusAndOwner(status, owner)` exists.
  async getTasksByStatus(status: TaskStatus, owner?: TaskOwner): Promise<Task[]> {
    if (owner) {
      // This is a placeholder for the more specific query needed for analytics
      const tasks = await storage.tasks.getTasksByUserId(''); // This needs a proper implementation
      return tasks.filter((t) => t.status === status && t.owner === owner);
    }
    const tasks = await storage.tasks.getTasksByUserId(''); // This needs a proper implementation
    return tasks.filter((t) => t.status === status);
  }

  async getTaskDetails(
    taskId: string
  ): Promise<(Task & { subtasks: Task[]; activities: TaskActivity[] }) | undefined> {
    const task = await storage.tasks.findTaskById(taskId);
    if (!task) return undefined;

    const [subtasks, activities] = await Promise.all([
      storage.tasks.getSubtasks(taskId),
      storage.tasks.getTaskActivities(taskId),
    ]);

    return { ...task, subtasks, activities };
  }

  async createTask(userId: string, taskData: Omit<InsertTask, 'userId'>): Promise<Task> {
    const task = await storage.tasks.createTask({ ...taskData, userId });

    await storage.tasks.createTaskActivity({
      taskId: task.id,
      actorType: 'user',
      actorId: userId,
      actionType: 'created',
      description: `Task created: ${task.title}`,
      metadata: { priority: task.priority, owner: task.owner },
    });

    return task;
  }

  async updateTask(userId: string, taskId: string, updates: Partial<InsertTask>): Promise<Task> {
    const task = await storage.tasks.updateTask(taskId, updates);

    const activityDescription = Object.keys(updates)
      .map((key) => {
        const value = updates[key as keyof typeof updates];
        if (key === 'status') return `Status changed to ${String(value)}`;
        if (key === 'priority') return `Priority changed to ${String(value)}`;
        if (key === 'completedAt' && value) return 'Task completed';
        return `${key} updated`;
      })
      .join(', ');

    await storage.tasks.createTaskActivity({
      taskId: task.id,
      actorType: 'user',
      actorId: userId,
      actionType: 'updated',
      description: activityDescription,
      metadata: updates,
    });

    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return storage.tasks.deleteTask(taskId);
  }

  async delegateTaskToAI(
    userId: string,
    details: {
      title: string;
      description?: string;
      contactIds: string[];
      dueDate?: Date;
      projectId?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    }
  ): Promise<Task> {
    // Assuming taskAI.delegateTaskToAI returns the created Task object
    return taskAI.delegateTaskToAI(userId, details);
  }

  async bulkCreateTask(
    userId: string,
    details: {
      title?: string;
      description?: string;
      contactIds?: string[];
      dueDate?: string;
      projectId?: string;
      owner?: string;
    }
  ): Promise<Task> {
    if (details.owner === 'ai_assistant') {
      return this.delegateTaskToAI(userId, {
        title: details.title ?? '',
        description: details.description ?? '',
        contactIds: details.contactIds ?? [],
        dueDate: details.dueDate ? new Date(details.dueDate) : undefined,
        projectId: details.projectId ?? undefined,
      });
    } else {
      const task = await storage.tasks.createTask({
        userId,
        title: details.title ?? '',
        description: details.description ?? '',
        assignedContactIds: details.contactIds ?? [],
        dueDate: details.dueDate ? new Date(details.dueDate) : undefined,
        projectId: details.projectId ?? undefined,
        owner: 'user',
      });

      const contactCount = details.contactIds?.length ?? 0;
      await storage.tasks.createTaskActivity({
        taskId: task.id,
        actorType: 'user',
        actorId: userId,
        actionType: 'created',
        description: `Bulk task created for ${contactCount} contacts`,
        metadata: { contactCount },
      });
      return task;
    }
  }

  async getTaskAnalytics(userId: string): Promise<{
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    overdueTasks: number;
    todaysTasks: number;
    aiTasksInProgress: number;
    completionRate: string;
  }> {
    const [allTasks, pendingTasks, completedTasks, aiTasks] = await Promise.all([
      storage.tasks.getTasksByUserId(userId),
      storage.tasks.getTasksByUserId(userId, ['pending']),
      storage.tasks.getTasksByUserId(userId, ['completed']),
      this.getTasksByStatus('in_progress', 'ai_assistant'),
    ]);

    const overdueTasks = allTasks.filter(
      (task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed'
    );
    const todaysTasks = allTasks.filter(
      (task) => task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString()
    );

    return {
      totalTasks: allTasks.length,
      pendingTasks: pendingTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      todaysTasks: todaysTasks.length,
      aiTasksInProgress: aiTasks.length,
      completionRate:
        allTasks.length > 0 ? ((completedTasks.length / allTasks.length) * 100).toFixed(1) : '0',
    };
  }
}

export const taskService = new TaskService();
