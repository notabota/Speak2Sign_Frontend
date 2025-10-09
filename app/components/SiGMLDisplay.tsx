'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { User } from 'lucide-react';

interface SiGMLDisplayProps {
  sigml: string;
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

export const SiGMLDisplay: React.FC<SiGMLDisplayProps> = ({ sigml, isVisible }) => {
  const [selectedAvatar, setSelectedAvatar] = useState('luna');
  const [cwasakLoaded, setCwasaLoaded] = useState(false);

  const initOnceRef = useRef(false);
  const lastSigmlRef = useRef<string>('');
  const lastTokenCountRef = useRef<number>(0);
  const pendingSigmlRef = useRef<string | null>(null);

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

  // --- Load & init CWASA (once) ---
  useEffect(() => {
    console.info(`[SB ${ts()}] mount isVisible=${isVisible} hasSigml=${!!sigml}`);
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

        if (pendingSigmlRef.current) {
          const pending = pendingSigmlRef.current;
          pendingSigmlRef.current = null;
          console.info(`[SB ${ts()}] consuming pending SiGML after init (len=${pending.length})`);
          try {
            window.CWASA.playSiGMLText(pending);
            lastSigmlRef.current = pending;
            const { tokens } = tokenizeFromSigML(pending);
            lastTokenCountRef.current = tokens.length;
            console.info(`[SB ${ts()}] played pending; baseline tokenCount=${tokens.length}`);
          } catch (e) {
            console.error(`[SB ${ts()}] playSiGMLText (pending) error`, e);
          }
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

  // --- Auto-play ---
  useEffect(() => {
    const ready = isVisible && cwasakLoaded && !!window.CWASA;
    console.debug(`[SB ${ts()}] auto-play check → ready=${ready}, hasSigML=${!!sigml}`);

    if (!sigml || !sigml.trim()) return;

    if (!ready) {
      pendingSigmlRef.current = sigml;
      console.info(`[SB ${ts()}] queued sigml (len=${sigml.length}) until CWASA ready`);
      return;
    }

    const { tokens, source } = tokenizeFromSigML(sigml);
    console.info(`[SB ${ts()}] token source=${source}, count=${tokens.length}`);
    console.debug(`[SB ${ts()}] tokens (first 20)`, tokens.slice(0, 20));
    console.log(`[SB ${ts()}] incoming sigml (preview): len=${sigml.length} :: "${preview(sigml, 120)}"`);

    const prev = lastTokenCountRef.current;
    const curr = tokens.length;
    console.info(`[SB ${ts()}] tokenCount: prev=${prev} → curr=${curr}`);

    if (curr > prev) {
      try {
        console.info(`[SB ${ts()}] auto-playing NEW SiGML…`);
        window.CWASA.playSiGMLText(sigml);
        lastSigmlRef.current = sigml;
        lastTokenCountRef.current = curr;
        console.info(`[SB ${ts()}] playback issued ✔ (baseline now ${curr})`);
      } catch (e) {
        console.error(`[SB ${ts()}] playSiGMLText error`, e);
      }
    } else if (sigml !== lastSigmlRef.current) {
      lastSigmlRef.current = sigml;
      lastTokenCountRef.current = curr;
      console.debug(`[SB ${ts()}] baseline updated (no growth)`);
    }
  }, [sigml, cwasakLoaded, isVisible]);

  const hasContent = !!sigml && sigml.trim().length > 0;

  return (
      <Card className="p-4 bg-gradient-subtle border-2 border-accent/20 shadow-soft">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Sign Language Animation</h3>
            <Badge
                variant={hasContent ? 'default' : 'outline'}
                className={hasContent ? 'bg-green-100 text-green-700 border-green-200 text-xs' : 'bg-gray-50 text-gray-500 border-gray-200 text-xs'}
            >
              {hasContent ? 'Auto' : 'Waiting…'}
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

          {hasContent && (
              <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
                <p className="text-xs text-muted-foreground mb-2">SiGML Code Preview:</p>
                <code className="text-xs text-foreground block max-h-20 overflow-y-auto">
                  {sigml.substring(0, 200)}…
                </code>
              </div>
          )}
        </div>
      </Card>
  );
};
