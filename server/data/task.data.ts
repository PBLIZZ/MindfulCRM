import { db } from '../db.js';
import {
  projects,
  tasks,
  taskActivities,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type TaskActivity,
  type InsertTaskActivity,
} from '../../shared/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export class TaskData {
  // --- Projects ---
  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.isArchived, false)))
      .orderBy(desc(projects.createdAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.update(projects).set({ isArchived: true }).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // --- Tasks ---
  async findTaskById(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksByUserId(userId: string, statuses?: string[]): Promise<Task[]> {
    const conditions = [eq(tasks.userId, userId)];
    if (statuses && statuses.length > 0) {
      conditions.push(sql`${tasks.status} = ANY(${statuses})`);
    }
    return db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.parentTaskId, parentTaskId))
      .orderBy(desc(tasks.createdAt));
  }

  // --- Task Activities ---
  async getTaskActivities(taskId: string): Promise<TaskActivity[]> {
    return db
      .select()
      .from(taskActivities)
      .where(eq(taskActivities.taskId, taskId))
      .orderBy(desc(taskActivities.createdAt));
  }

  async createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity> {
    const [newActivity] = await db.insert(taskActivities).values(activity).returning();
    return newActivity;
  }
}
