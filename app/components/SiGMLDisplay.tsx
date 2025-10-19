'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { User } from 'lucide-react';

interface SentenceSegment {
  transcription: string;
  gloss: string;
  sigml: string;
}

interface SiGMLDisplayProps {
  sentences: SentenceSegment[];
  currentSegment: Partial<SentenceSegment>;
  isVisible: boolean;
}

declare global {
  interface Window {
    CWASA: {
      init: (config?: any) => void;
      playSiGMLURL: (url: string) => void;
      playSiGMLText: (text: string) => void;
    };
  }
}

export const SiGMLDisplay: React.FC<SiGMLDisplayProps> = ({ sentences, currentSegment, isVisible }) => {
  const [selectedAvatar, setSelectedAvatar] = useState('luna');
  const [cwasakLoaded, setCwasaLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playedSentences, setPlayedSentences] = useState(0);
  const [currentlyPlayingGloss, setCurrentlyPlayingGloss] = useState<string>('');
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);

  const initOnceRef = useRef(false);
  const pendingSentencesRef = useRef<SentenceSegment[]>([]);
  const playbackQueueRef = useRef<SentenceSegment[]>([]);
  const isPlayingRef = useRef(false);

  const ts = () => new Date().toISOString().slice(11, 23);

  const stripTags = (text: string) => text.replace(/<[^>]*>/g, ' ');

  // Extract tokens from gloss attributes, fallback to text if empty
  const extractGlossTokens = (xml: string) => {
    const tokens: string[] = [];
    if (!xml) return tokens;
    const glossIter = xml.matchAll(/<hns_sign[^>]*\bgloss="([^"]+)"/gi);
    for (const m of Array.from(glossIter)) {
      const val = (m[1] || '').trim();
      if (!val) continue;
      const sub = val.match(/[a-z0-9_+\-?]+/gi);
      if (sub) tokens.push(...sub);
    }
    return tokens;
  };

  const tokenizeFromSigML = (xml: string) => {
    const glossTokens = extractGlossTokens(xml);
    if (glossTokens.length > 0) return { tokens: glossTokens, source: 'gloss-attr' };
    const core = stripTags(xml).toLowerCase();
    const textTokens = core.match(/[a-z0-9_]+/gi) || [];
    return { tokens: textTokens, source: 'text-fallback' };
  };

  const preview = (s: string, n = 100) => {
    const clean = (s || '').replace(/\s+/g, ' ').trim();
    return clean.length > n ? `${clean.slice(0, n)}…` : clean;
  };

  // Estimate animation duration based on gloss content
  const estimateAnimationDuration = (gloss: string): number => {
    const words = gloss.trim().split(/\s+/).filter(w => w.length > 0);
    // Rough estimate: 800ms per sign + 200ms base time
    return Math.max(1000, words.length * 800 + 200);
  };

  // Sequential sentence player - waits for each animation to finish
  const playNextSentence = async () => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;

    const sentence = playbackQueueRef.current.shift();
    if (!sentence || !sentence.sigml?.trim()) {
      // No valid sentence, try next
      setTimeout(playNextSentence, 50);
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    setCurrentlyPlayingGloss(sentence.gloss);

    // Animate through gloss words
    const glossWords = sentence.gloss.trim().split(/\s+/).filter(w => w.length > 0);
    const wordDuration = Math.max(600, estimateAnimationDuration(sentence.gloss) / glossWords.length);

    try {
      console.info(`[SB ${ts()}] playing sentence: "${preview(sentence.transcription, 60)}" → gloss: "${sentence.gloss}"`);
      window.CWASA.playSiGMLText(sentence.sigml);

      // Animate through words
      for (let i = 0; i < glossWords.length; i++) {
        setCurrentWordIndex(i);
        await new Promise(resolve => setTimeout(resolve, wordDuration));
      }

      // Wait a bit after animation completes
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (e) {
      console.error(`[SB ${ts()}] playSiGMLText error`, e);
    }

    // Clear current playing state
    setCurrentlyPlayingGloss('');
    setCurrentWordIndex(-1);
    isPlayingRef.current = false;
    setIsPlaying(false);

    // Play next sentence in queue
    setTimeout(playNextSentence, 100);
  };

  // --- Load & init CWASA (once) ---
  useEffect(() => {
    console.info(`[SB ${ts()}] mount isVisible=${isVisible} sentenceCount=${sentences.length}`);
    if (!isVisible) return;

    const ensureContainer = () => {
      const ok = !!document.querySelector('.CWASAAvatar.av0');
      console.debug(`[SB ${ts()}] container present? ${ok}`);
      return ok;
    };

    const doInit = () => {
      if (!window.CWASA) {
        console.warn(`[SB ${ts()}] CWASA not found on window at init`);
        return;
      }
      const cfg = {
        avsbsl: ["luna", "siggi", "anna", "marc", "francoise"],
        avSettings: { avList: "avsbsl", initAv: selectedAvatar }
      };
      console.info(`[SB ${ts()}] calling CWASA.init`);
      try {
        window.CWASA.init(cfg);
        initOnceRef.current = true;
        setCwasaLoaded(true);
        console.info(`[SB ${ts()}] CWASA initialized ✔`);

        // Play any pending sentences after initialization
        if (pendingSentencesRef.current.length > 0) {
          const pendingSentences = pendingSentencesRef.current;
          pendingSentencesRef.current = [];
          console.info(`[SB ${ts()}] consuming ${pendingSentences.length} pending sentences after init`);

          // Add to playback queue
          playbackQueueRef.current.push(...pendingSentences);
          playNextSentence();
        }
      } catch (e) {
        console.error(`[SB ${ts()}] CWASA.init error`, e);
      }
    };

    const load = () => {
      if (initOnceRef.current) {
        console.debug(`[SB ${ts()}] skip init (already done)`);
        return;
      }
      if (!document.querySelector('#cwasa-css')) {
        const css = document.createElement('link');
        css.id = 'cwasa-css';
        css.rel = 'stylesheet';
        css.href = '/jas/loc2025/cwa/cwasa.css';
        document.head.appendChild(css);
        console.info(`[SB ${ts()}] injected CWASA CSS`);
      }

      if (!document.querySelector('#cwasa-js')) {
        const js = document.createElement('script');
        js.id = 'cwasa-js';
        js.type = 'text/javascript';
        js.src = '/jas/loc2025/cwa/allcsa.js';
        js.onload = () => {
          console.info(`[SB ${ts()}] CWASA script loaded`);
          setTimeout(() => {
            if (!ensureContainer()) {
              console.warn(`[SB ${ts()}] container missing — retrying in 600ms`);
              setTimeout(() => (ensureContainer() ? doInit() : console.error(`[SB ${ts()}] container still missing`)), 600);
              return;
            }
            doInit();
          }, 250);
        };
        js.onerror = (e) => console.error(`[SB ${ts()}] CWASA script failed`, e);
        document.head.appendChild(js);
        console.info(`[SB ${ts()}] injected CWASA JS`);
      } else {
        console.debug(`[SB ${ts()}] CWASA JS present`);
        if (ensureContainer() && window.CWASA && !initOnceRef.current) doInit();
      }
    };

    load();
  }, [isVisible, selectedAvatar]);

  useEffect(() => {
    console.debug(`[SB ${ts()}] cwasaLoaded=${cwasakLoaded}`);
  }, [cwasakLoaded]);

  // --- Sequential Sentence Playback ---
  useEffect(() => {
    const ready = isVisible && cwasakLoaded && !!window.CWASA;
    console.debug(`[SB ${ts()}] sentence playback check → ready=${ready}, newSentences=${sentences.length - playedSentences}`);

    if (sentences.length <= playedSentences) return;

    const newSentences = sentences.slice(playedSentences);

    if (!ready) {
      // Queue new sentences until CWASA is ready
      pendingSentencesRef.current.push(...newSentences);
      console.info(`[SB ${ts()}] queued ${newSentences.length} sentences until CWASA ready`);
      setPlayedSentences(sentences.length);
      return;
    }

    // Add new sentences to playback queue
    playbackQueueRef.current.push(...newSentences);
    console.info(`[SB ${ts()}] added ${newSentences.length} sentences to playback queue`);

    // Start playing if not already playing
    if (!isPlayingRef.current) {
      playNextSentence();
    }

    // Update played count
    setPlayedSentences(sentences.length);
  }, [sentences, cwasakLoaded, isVisible, playedSentences]);

  // Reset played count when recording is cleared
  useEffect(() => {
    if (sentences.length === 0) {
      setPlayedSentences(0);
      pendingSentencesRef.current = [];
      playbackQueueRef.current = [];
      setCurrentlyPlayingGloss('');
      setCurrentWordIndex(-1);
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [sentences.length]);

  const hasContent = sentences.length > 0 || (currentSegment.sigml && currentSegment.sigml.trim().length > 0);
  const latestSigml = sentences.length > 0 ? sentences[sentences.length - 1].sigml : (currentSegment.sigml || '');

  return (
      <Card className="p-4 bg-gradient-subtle border-2 border-accent/20 shadow-soft">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Sign Language Animation</h3>
            <Badge
                variant={hasContent ? 'default' : 'outline'}
                className={hasContent ? 'bg-green-100 text-green-700 border-green-200 text-xs' : 'bg-gray-50 text-gray-500 border-gray-200 text-xs'}
            >
              {hasContent ? `${sentences.length} sentences` : 'Waiting…'}
            </Badge>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 min-h-[420px] flex flex-col items-center justify-center">
            <div
                style={{
                  width: '300px',
                  height: '250px',
                  margin: '0 auto 12px auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  position: 'relative'
                }}
            >
              <div className="CWASAAvatar av0" style={{ width: '100%', height: '100%', textAlign: 'center' }} />
              {!cwasakLoaded && (
                  <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none'
                      }}
                  >
                    <User size={48} className="text-accent mx-auto" />
                    <p className="text-muted-foreground">Loading 3D Avatar…</p>
                  </div>
              )}
            </div>
            <div className="CWASAAvMenu av0 mt-2"></div>
            <div className="CWASASpeed av0 mt-1"></div>
            <input type="text" className="txtSiGMLURL av0" style={{ display: 'none' }} defaultValue="" />
          </div>

          {currentlyPlayingGloss && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <p className="text-xs text-green-700 font-medium mb-2">Currently Playing:</p>
                <div className="flex flex-wrap gap-1">
                  {currentlyPlayingGloss.split(' ').filter(w => w.length > 0).map((word, index) => (
                    <Badge
                      key={index}
                      className={`px-2 py-1 text-xs font-semibold transition-all duration-200 ${
                        index === currentWordIndex
                          ? 'bg-green-500 text-white border-green-600 transform scale-110'
                          : index < currentWordIndex
                          ? 'bg-green-200 text-green-700 border-green-300'
                          : 'bg-green-100 text-green-600 border-green-200'
                      }`}
                    >
                      {word}
                    </Badge>
                  ))}
                </div>
              </div>
          )}

          {hasContent && (
              <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
                <p className="text-xs text-muted-foreground mb-2">Latest SiGML Preview:</p>
                <code className="text-xs text-foreground block max-h-20 overflow-y-auto">
                  {latestSigml.substring(0, 200)}…
                </code>
              </div>
          )}
        </div>
      </Card>
  );
};
