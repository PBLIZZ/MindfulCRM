import { storage } from '../data/index.js';

type DashboardStats = {
  totalClients: number;
  weeklySessions: number;
  achievedGoals: number;
  responseRate: number;
};

export class DashboardService {
  async getStats(userId: string): Promise<DashboardStats> {
    // This service acts as a pass-through to the data layer's aggregate stats method.
    // The logic is correctly placed in the data layer as it's purely a database query.
    return storage.misc.getStats(userId);
  }
}

export const dashboardService = new DashboardService();
