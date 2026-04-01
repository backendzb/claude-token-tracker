import { invoke } from '@tauri-apps/api/core';
import type { UsageRecord, UsageOptions, SessionSummary, BucketData } from './types';

export const api = {
  getUsage: (options?: UsageOptions) =>
    invoke<UsageRecord[]>('get_usage', { options }),

  getProjects: () =>
    invoke<string[]>('get_projects'),

  getSessions: (options?: UsageOptions) =>
    invoke<SessionSummary[]>('get_sessions', { options }),

  getBuckets: (options?: UsageOptions) =>
    invoke<BucketData[]>('get_buckets', { options }),

  getVersion: () =>
    invoke<string>('get_version'),
};
