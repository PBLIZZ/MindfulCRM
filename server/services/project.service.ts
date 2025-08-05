import { storage } from '../data/index.js';
import { type Project, type InsertProject } from '../../shared/schema.js';

export class ProjectService {
  async getProjects(userId: string): Promise<Project[]> {
    // Project logic now resides in the 'tasks' data module
    return storage.tasks.getProjectsByUserId(userId);
  }

  async createProject(
    userId: string,
    projectData: Omit<InsertProject, 'userId'>
  ): Promise<Project> {
    // Project logic now resides in the 'tasks' data module
    return storage.tasks.createProject({ ...projectData, userId });
  }

  async updateProject(projectId: string, updates: Partial<InsertProject>): Promise<Project> {
    // Project logic now resides in the 'tasks' data module
    return storage.tasks.updateProject(projectId, updates);
  }

  async deleteProject(projectId: string): Promise<boolean> {
    // Project logic now resides in the 'tasks' data module
    return storage.tasks.deleteProject(projectId);
  }
}

export const projectService = new ProjectService();
