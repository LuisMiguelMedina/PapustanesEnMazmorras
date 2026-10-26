/**
 * DataAccess layer for Campaigns conforming to Constitution_Brendup.md.
 * All classes and methods are strictly static, adhere to transactional responses,
 * and contain zero unhandled throw statements.
 */

import { CAMPAIGNS_SEED } from '../data/campaigns.seed';
import { CampaignBase, CampaignFilter, CampaignFind } from '../models/Campaigns/CampaignModels';
import { ResponseObject } from '../models/Common/TransactionModels';

export class CampaignDataAccess {
  /**
   * Helper to retrieve all campaigns, merging base seeds, user-created local campaigns,
   * and any field overrides from localStorage.
   */
  public static getAllCampaigns(): CampaignBase[] {
    let list: CampaignBase[] = [...CAMPAIGNS_SEED];

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('mom_local_campaigns');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const existingIds = new Set(list.map((c) => c.CampaignID));
            for (const item of parsed) {
              if (item && item.CampaignID && !existingIds.has(item.CampaignID)) {
                list.push(item);
                existingIds.add(item.CampaignID);
              }
            }
          }
        }

        const overridesStr = localStorage.getItem('mom_campaign_overrides');
        if (overridesStr) {
          const overrides: Record<string, Partial<CampaignBase>> = JSON.parse(overridesStr);
          list = list.map((c) =>
            overrides[c.CampaignID] ? { ...c, ...overrides[c.CampaignID] } : c,
          );
        }
      } catch {
        // Fallback gracefully to default list
      }
    }

    return list;
  }

  /**
   * Lists campaigns matching optional filter criteria.
   */
  public static List(filter?: CampaignFilter | null): ResponseObject<CampaignBase[]> {
    try {
      let results: CampaignBase[] = this.getAllCampaigns();

      if (filter) {
        if (filter.Status) {
          results = results.filter((c) => c.CampaignStatus === filter.Status);
        }
        if (filter.SearchTerm) {
          const query = filter.SearchTerm.toLowerCase().trim();
          results = results.filter(
            (c) =>
              c.CampaignTitle.toLowerCase().includes(query) ||
              c.CampaignDescription.toLowerCase().includes(query) ||
              c.CampaignTags.some((tag) => tag.toLowerCase().includes(query)),
          );
        }
      }

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: `Found ${results.length} campaign(s).`,
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: results,
      };
    } catch {
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: 'Error listing campaigns.',
        ErrorNumber: 500,
        ServerName: 'local-portal',
        Result: null,
      };
    }
  }

  /**
   * Finds a single campaign by ID or Slug.
   */
  public static Find(find: CampaignFind): ResponseObject<CampaignBase> {
    try {
      const allCampaigns = this.getAllCampaigns();
      const target = allCampaigns.find(
        (c) =>
          c.CampaignID.toLowerCase() === find.CampaignID.toLowerCase() ||
          (c.CampaignSlug && c.CampaignSlug.toLowerCase() === find.CampaignID.toLowerCase()),
      );

      if (!target) {
        return {
          CodeNumber: 404,
          CodeName: 'NotFound',
          Message: `Campaign with ID '${find.CampaignID}' was not found.`,
          ErrorNumber: 404,
          ServerName: 'local-portal',
          Result: null,
        };
      }

      return {
        CodeNumber: 302,
        CodeName: 'Found',
        Message: 'Campaign found successfully.',
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: target,
      };
    } catch {
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: 'Error finding campaign.',
        ErrorNumber: 500,
        ServerName: 'local-portal',
        Result: null,
      };
    }
  }
}
