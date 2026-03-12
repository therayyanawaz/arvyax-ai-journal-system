import type { Request, Response } from 'express';

import { BaseController } from './baseController.js';
import { AnalysisService } from '../services/analysisService.js';
import { JournalService } from '../services/journalService.js';
import {
  analyzeJournalSchema,
  createJournalSchema,
  userIdParamSchema
} from '../validators/journalSchemas.js';

export class JournalController extends BaseController {
  constructor(
    private readonly journalService: JournalService,
    private readonly analysisService: AnalysisService
  ) {
    super();
  }

  createEntry = async (req: Request, res: Response) => {
    try {
      const input = createJournalSchema.parse(req.body);
      const entry = await this.journalService.createEntry(input);
      return this.sendSuccess(res, entry, 201);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  listEntries = async (req: Request, res: Response) => {
    try {
      const { userId } = userIdParamSchema.parse(req.params);
      const entries = await this.journalService.getEntries(userId);
      return this.sendSuccess(res, entries);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  analyzeEntry = async (req: Request, res: Response) => {
    try {
      const input = analyzeJournalSchema.parse(req.body);
      const analysis = await this.analysisService.analyze(input);
      return this.sendSuccess(res, analysis);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  getInsights = async (req: Request, res: Response) => {
    try {
      const { userId } = userIdParamSchema.parse(req.params);
      const insights = await this.journalService.getInsights(userId);
      return this.sendSuccess(res, insights);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
}

