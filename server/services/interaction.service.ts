import { storage } from '../data/index.js';
import { SentimentAnalysisBrain } from '../brains/sentiment-analysis.brain.js';
import { mistralService } from '../providers/mistral.provider.js';
import type {
  Interaction,
  InsertInteraction,
  Goal,
  InsertGoal,
  Contact,
} from '../../shared/schema.js';

export class InteractionService {
  async getRecentInteractions(
    userId: string,
    limit: number
  ): Promise<(Interaction & { contact: Contact })[]> {
    return storage.interactions.getRecentForUser(userId, limit);
  }

  async createInteraction(interactionData: InsertInteraction): Promise<Interaction> {
    const dataToInsert = { ...interactionData };

    // BUSINESS LOGIC: Auto-analyze sentiment if not provided.
    // This logic correctly lives in the service layer, not the data access layer.
    if (!dataToInsert.sentiment && dataToInsert.content) {
      try {
        const sentimentBrain = new SentimentAnalysisBrain();
        const sentimentResult = await sentimentBrain.execute(
          mistralService,
          'mistral-small-latest',
          dataToInsert.content
        );
        dataToInsert.sentiment = sentimentResult.rating;
      } catch (error) {
        // Non-critical error, so we just log a warning and proceed
        console.warn('Failed to analyze sentiment for interaction:', error);
      }
    }

    return storage.interactions.create(dataToInsert);
  }

  async createGoal(goalData: InsertGoal): Promise<Goal> {
    return storage.interactions.createGoal(goalData);
  }

  async updateGoal(goalId: string, updates: Partial<InsertGoal>): Promise<Goal> {
    return storage.interactions.updateGoal(goalId, updates);
  }
}

export const interactionService = new InteractionService();
