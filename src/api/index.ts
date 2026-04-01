import { invoke } from '@tauri-apps/api/core';
import type { UsageRecord, UsageOptions, SessionSummary, BucketData } from './types';

export const api = {
  getUsage: (options?: UsageOptions) => invoke<UsageRecord[]>('get_usage', { options }),
  getProjects: () => invoke<string[]>('get_projects'),
  getSessions: (options?: UsageOptions) => invoke<SessionSummary[]>('get_sessions', { options }),
  getBuckets: (options?: UsageOptions) => invoke<BucketData[]>('get_buckets', { options }),
  getTimeBuckets: (options?: UsageOptions) => invoke<BucketData[]>('get_time_buckets', { options }),
  getVersion: () => invoke<string>('get_version'),
  getSettings: () => invoke<any>('get_settings'),
  saveSettings: (settings: any) => invoke<any>('save_settings', { settings }),
  getSessionIndex: () => invoke<any[]>('get_session_index'),
  loadConversation: (sessionId: string) => invoke<any>('load_conversation', { sessionId }),
  getPricingMap: () => invoke<any>('get_pricing_map'),
  exportData: (format: string, records: any[]) => invoke<string>('export_data', { format, records }),
  switchContext: (sessionId: string, cwd: string) => invoke<any>('switch_context', { sessionId, cwd }),
  toggleFloatWindow: () => invoke<any>('toggle_float_window'),
  getFloatVisible: () => invoke<boolean>('get_float_visible'),
  registerShortcuts: () => invoke('register_shortcuts_cmd'),
};
