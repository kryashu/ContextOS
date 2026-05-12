import { describe, it, expect } from 'vitest';
import { QuestionRouter } from '../question-router.js';

describe('QuestionRouter', () => {
  const router = new QuestionRouter();

  it('classifies "about" questions', () => {
    expect(router.classify('What is this workspace about?')).toBe('about');
    expect(router.classify('Give me an overview')).toBe('about');
    expect(router.classify('Summarize this workspace')).toBe('about');
  });

  it('classifies "irrelevant_files" questions', () => {
    expect(router.classify('Which files are irrelevant?')).toBe('irrelevant_files');
    expect(router.classify('Are there any low-value files?')).toBe('irrelevant_files');
    expect(router.classify('Show me the noise files')).toBe('irrelevant_files');
  });

  it('classifies "capabilities" questions', () => {
    expect(router.classify('What calculations are possible?')).toBe('capabilities');
    expect(router.classify('What can I do with this workspace?')).toBe('capabilities');
    expect(router.classify('What are the capabilities?')).toBe('capabilities');
  });

  it('classifies "sheet_query" questions', () => {
    expect(router.classify('Which sheets are about revenue?')).toBe('sheet_query');
    expect(router.classify('Tell me about the Excel workbook')).toBe('sheet_query');
    expect(router.classify('What spreadsheets are available?')).toBe('sheet_query');
  });

  it('classifies "document_fact" for general questions', () => {
    expect(router.classify('How many patients were enrolled in the trial?')).toBe('document_fact');
    expect(router.classify('What was the primary endpoint result?')).toBe('document_fact');
  });

  it('returns "unknown" for empty or very short input', () => {
    expect(router.classify('')).toBe('unknown');
    expect(router.classify('hi')).toBe('unknown');
    expect(router.classify('yes')).toBe('unknown');
  });
});
