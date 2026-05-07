import type { Cue, FocalWord, Segment } from '../../contracts/src/index.js';

import { countWords, padId, splitLines, tokenizeWords } from './utils.js';

export interface EffectiveCue extends Cue {
  effectiveText: string;
  skip: boolean;
}

export interface SegmentationProfile {
  id: string;
  name: string;
  strategy: 'readable-bursts-v1';
  params: {
    maxCharsPerSegment: number;
    maxWordsPerSegment: number;
    maxDurationMs: number;
    maxGapMs: number;
    maxCuesPerSegment: number;
    safeLineChars: number;
    maxLines: number;
  };
}

export const segmentationProfiles: Record<string, SegmentationProfile> = {
  'shorts-a2': {
    id: 'shorts-a2',
    name: 'Shorts A2 readable bursts',
    strategy: 'readable-bursts-v1',
    params: {
      maxCharsPerSegment: 42,
      maxWordsPerSegment: 8,
      maxDurationMs: 2600,
      maxGapMs: 250,
      maxCuesPerSegment: 2,
      safeLineChars: 20,
      maxLines: 2,
    },
  },
  'study-calm': {
    id: 'study-calm',
    name: 'Study calm readable chunks',
    strategy: 'readable-bursts-v1',
    params: {
      maxCharsPerSegment: 64,
      maxWordsPerSegment: 14,
      maxDurationMs: 4200,
      maxGapMs: 500,
      maxCuesPerSegment: 3,
      safeLineChars: 28,
      maxLines: 3,
    },
  },
};

const stopwords = new Set([
  'als',
  'am',
  'an',
  'auch',
  'das',
  'dein',
  'den',
  'der',
  'die',
  'dir',
  'ein',
  'eine',
  'einer',
  'einem',
  'einen',
  'ganz',
  'heute',
  'ist',
  'mit',
  'und',
  'wir',
]);

export function toEffectiveCues(cues: Cue[], overrides: { cueId: string; op: string; patch: Record<string, unknown> }[] = []): EffectiveCue[] {
  const overrideMap = new Map<string, { text?: string; startMs?: number; endMs?: number; skip?: boolean }>();

  for (const override of overrides) {
    const current = overrideMap.get(override.cueId) ?? {};
    if (override.op === 'replace-text' && typeof override.patch.normalizedText === 'string') {
      current.text = override.patch.normalizedText;
    }
    if (override.op === 'replace-timing') {
      if (typeof override.patch.startMs === 'number') {
        current.startMs = override.patch.startMs;
      }
      if (typeof override.patch.endMs === 'number') {
        current.endMs = override.patch.endMs;
      }
    }
    if (override.op === 'flag-skip') {
      current.skip = Boolean(override.patch.skip ?? true);
    }
    overrideMap.set(override.cueId, current);
  }

  return cues.map((cue) => {
    const applied = overrideMap.get(cue.id);
    const startMs = applied?.startMs ?? cue.startMs;
    const endMs = applied?.endMs ?? cue.endMs;
    const valid = cue.valid && endMs >= startMs;

    return {
      ...cue,
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      valid,
      invalidReason: valid ? cue.invalidReason : 'Cue override created invalid timing',
      effectiveText: applied?.text ?? cue.text.normalized,
      skip: applied?.skip ?? false,
    };
  });
}

export function pickFocalWords(text: string, limit = 2): FocalWord[] {
  const tokens = tokenizeWords(text);
  const candidates = tokens
    .map((word, index) => ({
      word,
      index,
      normalized: word.toLowerCase(),
      score: word.length,
    }))
    .filter((candidate) => candidate.word.length >= 5 && !stopwords.has(candidate.normalized));

  const selected = [...candidates]
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .sort((left, right) => left.index - right.index);

  return selected.map((candidate) => ({
    word: candidate.word,
    reason: 'long-content-word',
    score: candidate.score,
  }));
}

export function deriveSegmentsFromCues(cues: EffectiveCue[], profileId = 'shorts-a2'): { profile: SegmentationProfile; segments: Segment[] } {
  const profile = segmentationProfiles[profileId] ?? segmentationProfiles['shorts-a2']!;
  const usableCues = cues.filter((cue) => cue.valid && !cue.skip).sort((left, right) => left.startMs - right.startMs || left.sourceIndex - right.sourceIndex);
  const segments: Segment[] = [];
  let bucket: EffectiveCue[] = [];

  const flush = () => {
    if (bucket.length === 0) {
      return;
    }

    const text = bucket.map((cue) => cue.effectiveText).join(' ').replace(/\s+/g, ' ').trim();
    const startMs = bucket[0]!.startMs;
    const endMs = bucket[bucket.length - 1]!.endMs;
    const lineHints = splitLines(text, profile.params.safeLineChars, profile.params.maxLines);

    segments.push({
      id: padId('segment', segments.length + 1),
      strategy: profile.strategy,
      cueIds: bucket.map((cue) => cue.id),
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      text,
      wordCount: countWords(text),
      charCount: text.length,
      focalWords: pickFocalWords(text),
      lineHints,
      tokens: [],
      phrases: [],
      notes: [],
    });

    bucket = [];
  };

  for (const cue of usableCues) {
    if (bucket.length === 0) {
      bucket.push(cue);
      continue;
    }

    const candidate = [...bucket, cue];
    const candidateText = candidate.map((item) => item.effectiveText).join(' ').replace(/\s+/g, ' ').trim();
    const gapMs = cue.startMs - bucket[bucket.length - 1]!.endMs;
    const durationMs = cue.endMs - bucket[0]!.startMs;
    const exceeds =
      candidateText.length > profile.params.maxCharsPerSegment ||
      countWords(candidateText) > profile.params.maxWordsPerSegment ||
      durationMs > profile.params.maxDurationMs ||
      gapMs > profile.params.maxGapMs ||
      candidate.length > profile.params.maxCuesPerSegment;

    if (exceeds) {
      flush();
      bucket.push(cue);
      continue;
    }

    bucket.push(cue);
  }

  flush();
  return { profile, segments };
}
