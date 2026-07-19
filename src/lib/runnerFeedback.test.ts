import { describe, expect, it } from 'vitest';
import { formatRunnerResponseStats, formatRunnerStatusLabel, getRunnerStatusTag, isRunnerItemFinished, summarizeRunnerLiveProgress } from './runnerFeedback';

describe('Runner feedback formatting', () => {
  it('combines status codes and messages with standard reason fallback', () => {
    expect(formatRunnerStatusLabel({ statusCode: 200, statusMessage: 'OK' })).toBe('200 OK');
    expect(formatRunnerStatusLabel({ statusCode: 404 })).toBe('404 Not Found');
    expect(formatRunnerStatusLabel({ statusCode: 799 })).toBe('799');
    expect(formatRunnerStatusLabel({ statusMessage: 'Canceled' })).toBe('Canceled');
  });

  it('rounds response time and scales long byte units at pinned thresholds', () => {
    expect(formatRunnerResponseStats({ responseTime: 36.6, responseSize: 212 })).toBe('37ms - 212 bytes');
    expect(formatRunnerResponseStats({ responseTime: 1, responseSize: 4096 })).toBe('1ms - 4 kilobytes');
    expect(formatRunnerResponseStats({ responseSize: 2047.9 })).toBe('2047.9 bytes');
    expect(formatRunnerResponseStats({ responseSize: 2048 })).toBe('2 kilobytes');
    expect(formatRunnerResponseStats({ responseSize: 2 * 1024 * 1024 })).toBe('2 megabytes');
    expect(formatRunnerResponseStats({ responseSize: 2 * 1024 * 1024 * 1024 })).toBe('2 gigabytes');
  });

  it('omits absent and negative response statistics', () => {
    expect(formatRunnerResponseStats({})).toBe('');
    expect(formatRunnerResponseStats({ responseTime: -1, responseSize: -1 })).toBe('');
  });

  it('uses fixed lifecycle tags and HTTP status tones with ERROR fallback', () => {
    expect(getRunnerStatusTag({ status: 'running', statusCode: 500, statusMessage: 'Ignored' })).toEqual({ label: 'RUNNING', tone: 'running' });
    expect(getRunnerStatusTag({ status: 'completed', statusCode: 200, statusMessage: 'OK' })).toEqual({ label: '200 OK', tone: 'http-success' });
    expect(getRunnerStatusTag({ status: 'completed', statusCode: 302 })).toEqual({ label: '302 Found', tone: 'http-warning' });
    expect(getRunnerStatusTag({ status: 'completed', statusCode: 500 })).toEqual({ label: '500 Internal Server Error', tone: 'http-error' });
    expect(getRunnerStatusTag({ status: 'failed' })).toEqual({ label: 'ERROR', tone: 'http-error' });
  });

  it('summarizes active and canceled live progress without counting skipped or canceled requests as finished', () => {
    const items = [
      { key: 'completed', iteration: 1, requestId: 'completed', requestName: 'Completed', requestUrl: '', status: 'completed' as const },
      { key: 'failed', iteration: 1, requestId: 'failed', requestName: 'Failed', requestUrl: '', status: 'failed' as const },
      { key: 'skipped', iteration: 1, requestId: 'skipped', requestName: 'Skipped', requestUrl: '', status: 'skipped' as const },
      { key: 'canceled', iteration: 1, requestId: 'canceled', requestName: 'Canceled', requestUrl: '', status: 'canceled' as const },
      { key: 'running', iteration: 1, requestId: 'running', requestName: 'Running', requestUrl: '', status: 'running' as const },
    ];

    expect(isRunnerItemFinished('completed')).toBe(true);
    expect(isRunnerItemFinished('running')).toBe(false);
    expect(summarizeRunnerLiveProgress(items, true)).toEqual({ total: 5, finished: 2, skipped: 1, canceled: 1, label: 'Running 2 / 5 requests (1 skipped, 1 canceled)' });
    expect(summarizeRunnerLiveProgress(items, false).label).toBe('Finished 2 / 5 requests (1 skipped, 1 canceled)');
  });
});
