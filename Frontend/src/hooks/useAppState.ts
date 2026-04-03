import { useState, useCallback } from 'react';
import { mockResults } from '../data/mockResults';
import { mcpRun } from '../lib/mcp';
import { toMockResults } from '../lib/transform';
import type { MockResults } from '../data/mockResults';

type Page = 'landing' | 'intake' | 'analyzing' | 'results' | 'error';

export function useAppState() {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [formData, setFormData] = useState<any>({});
  const [resultsBackend, setResultsBackend] = useState<any>(null);
  const [resultsComputed, setResultsComputed] = useState<MockResults>(mockResults);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const goToIntake = useCallback(() => {
    setCurrentPage('intake');
    window.scrollTo(0, 0);
  }, []);

  const submitForm = useCallback((data: any) => {
    setFormData(data);
    setCurrentPage('analyzing');
    setErrorMessage('');
    // Fire-and-forget MCP call; navigate to results when done
    (async () => {
      // Poll until status === 'ok' with a timeout; show error on failure.
      const payload = {
        linkedin_url: data?.linkedinUrl || data?.linkedin_url || '',
        resume_text: data?.resumeText || data?.resume_text || ''
      };
      const intervalMs = 2_000;
      const timeoutMs = 120_000; // 2 minutes
      const start = Date.now();
      let resp: any | null = null;
      let lastError = '';
      // First attempt immediately
      try {
        resp = await mcpRun(payload);
      } catch (e: any) {
        lastError = e?.message || 'Network error';
        resp = null;
      }
      while ((!resp || resp?.status !== 'ok') && (Date.now() - start) < timeoutMs) {
        await sleep(intervalMs);
        try {
          resp = await mcpRun(payload);
        } catch (e: any) {
          lastError = e?.message || 'Network error';
          resp = null;
        }
      }

      if (resp?.status === 'ok') {
        setResultsBackend(resp);
        // Transform backend payload into dashboard shape
        const transformed = toMockResults(resp?.result || {});
        setResultsComputed(transformed);
        setFormData((prev: any) => ({ ...prev, backend: resp }));
        setCurrentPage('results');
      } else {
        // Timeout or persistent failure: show error page
        setResultsBackend(null);
        setErrorMessage(lastError || 'The analysis service did not respond in time. Please try again.');
        setCurrentPage('error');
      }

      window.scrollTo(0, 0);
    })();
  }, []);

  const goToResults = useCallback(() => {
    setCurrentPage('results');
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    if (currentPage === 'intake') setCurrentPage('landing');
    if (currentPage === 'results') setCurrentPage('landing');
    if (currentPage === 'error') setCurrentPage('landing');
  }, [currentPage]);

  const retrySubmit = useCallback(() => {
    if (formData?.linkedinUrl || formData?.linkedin_url) {
      submitForm(formData);
    } else {
      setCurrentPage('intake');
    }
  }, [formData, submitForm]);

  return {
    currentPage,
    formData,
    results: resultsComputed,
    resultsBackend,
    errorMessage,
    goToIntake,
    submitForm,
    goToResults,
    goBack,
    retrySubmit
  };
}
