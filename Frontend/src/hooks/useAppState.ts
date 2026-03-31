import { useState, useCallback } from 'react';
import { mockResults } from '../data/mockResults';
import { mcpRun } from '../lib/mcp';
import { toMockResults } from '../lib/transform';
import type { MockResults } from '../data/mockResults';

type Page = 'landing' | 'intake' | 'analyzing' | 'results';

export function useAppState() {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [formData, setFormData] = useState<any>({});
  const [resultsBackend, setResultsBackend] = useState<any>(null);
  const [resultsComputed, setResultsComputed] = useState<MockResults>(mockResults);

  const goToIntake = useCallback(() => {
    setCurrentPage('intake');
    window.scrollTo(0, 0);
  }, []);

  const submitForm = useCallback((data: any) => {
    setFormData(data);
    setCurrentPage('analyzing');
    // Fire-and-forget MCP call; navigate to results when done
    (async () => {
      // Poll until status === 'ok' with a timeout; fall back to mock results.
      const payload = {
        linkedin_url: data?.linkedinUrl || data?.linkedin_url || '',
        resume_text: data?.resumeText || data?.resume_text || ''
      };
      const intervalMs = 2_000;
      const timeoutMs = 120_000; // 2 minutes
      const start = Date.now();
      let resp: any | null = null;
      // First attempt immediately
      try {
        resp = await mcpRun(payload);
      } catch {
        resp = null;
      }
      while ((!resp || resp?.status !== 'ok') && (Date.now() - start) < timeoutMs) {
        await sleep(intervalMs);
        try {
          resp = await mcpRun(payload);
        } catch {
          // keep retrying until timeout
          resp = null;
        }
      }

      if (resp?.status === 'ok') {
        setResultsBackend(resp);
        // Transform backend payload into dashboard shape
        const transformed = toMockResults(resp?.result || {});
        setResultsComputed(transformed);
        setFormData((prev: any) => ({ ...prev, backend: resp }));
      } else {
        // Timeout: show mock results
        setResultsBackend(null);
        setResultsComputed(mockResults);
        setFormData((prev: any) => ({ ...prev, backend: null, backendTimeout: true }));
      }

      setCurrentPage('results');
      window.scrollTo(0, 0);
    })();
  }, []);

  const goToResults = useCallback(() => {
    setCurrentPage('results');
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    if (currentPage === 'intake') setCurrentPage('landing');
    if (currentPage === 'results') setCurrentPage('landing'); // Reset
  }, [currentPage]);

  return {
    currentPage,
    formData,
    results: resultsComputed,
    resultsBackend,
    goToIntake,
    submitForm,
    goToResults,
    goBack
  };
}