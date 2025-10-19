'use client'

import React, {useEffect, useState} from 'react';
import { TranscriptionDisplay } from '@/app/components/TranscriptionDisplay';
import { GlossDisplay } from '@/app/components/GlossDisplay';
import { SiGMLDisplay } from '@/app/components/SiGMLDisplay';
import { Card } from '@/app/components/ui/card';
import { Accessibility, Zap, Languages, Brain } from 'lucide-react';
import { VADVoiceRecorder } from "@/app/components/VADVoiceRecorder";

interface VADResult {
  transcription?: string;
  gloss?: string;
  sigml?: string;
  isNewSegment?: boolean;
}

interface SentenceSegment {
  transcription: string;
  gloss: string;
  sigml: string;
}

export default function HomePage() {
  const [sentences, setSentences] = useState<SentenceSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<Partial<SentenceSegment>>({});

  const handleVADUpdate = async (result: VADResult) => {
    console.log('VAD update received:', result);

    if (result.transcription) {
      // New transcription segment started - clear previous and set new
      setCurrentSegment({
        transcription: result.transcription
      });
    }

    if (result.gloss) {
      // Gloss received for current segment
      setCurrentSegment(prev => ({
        ...prev,
        gloss: result.gloss
      }));
    }

    if (result.sigml && result.isNewSegment) {
      // Complete segment ready - add to sentences and trigger animation
      const completeSegment: SentenceSegment = {
        transcription: currentSegment.transcription || '',
        gloss: result.gloss || currentSegment.gloss || '',
        sigml: result.sigml
      };

      // Add to sentences - don't clear current segment yet
      // It will be cleared when the next transcription starts
      setSentences(prev => [...prev, completeSegment]);

      // Trigger animation for this new segment
      // The SiGML component will auto-play when it receives new content
    }
  };

  const handleClearResults = () => {
    setSentences([]);
    setCurrentSegment({});
  };
  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <header className="px-6 py-6 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="bg-blue-950 p-2 rounded-full">
                <Accessibility className="h-6 w-6 text-orange-500" />
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-blue-900">
                SignBridge AI
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Smart voice detection with real-time sign language translation
            </p>
          </div>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <main className="px-6 flex-1 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">

          {/* Two Column Content */}
          <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-0">

            {/* Left Column - Controls and Text Results */}
            <div className="space-y-3 overflow-y-auto min-h-0">
              {/* Voice Recorder */}
              <VADVoiceRecorder onResult={handleVADUpdate} onClear={handleClearResults} />

              {/* Results Display - Always visible */}
              <div className="space-y-3">
                {/* Transcription Display */}
                <TranscriptionDisplay
                  transcription={sentences.map(s => s.transcription).join(' ') + (currentSegment.transcription && !sentences.find(s => s.transcription === currentSegment.transcription) ? ` ${currentSegment.transcription}` : '')}
                  isVisible={true}
                  language="English"
                />

                {/* Gloss Display */}
                <GlossDisplay
                  glossText={sentences.map(s => s.gloss).join(' ') + (currentSegment.gloss && !sentences.find(s => s.gloss === currentSegment.gloss) ? ` ${currentSegment.gloss}` : '')}
                  isVisible={true}
                  originalText={sentences.map(s => s.transcription).join(' ')}
                />
              </div>
            </div>

            {/* Right Column - Avatar Display */}
            <div className="flex flex-col min-h-0">
              <div className="flex-1 flex items-center justify-center">
                {/* SiGML Display - Always visible */}
                <div className="w-full h-full">
                  <SiGMLDisplay
                    sentences={sentences}
                    currentSegment={currentSegment}
                    isVisible={true}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* How It Works - Bottom Section */}
          <div className="mt-4 flex-shrink-0">
            <Card className="p-4 bg-card/30 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-3 text-center">How It Works</h3>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div className="space-y-2">
                  <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <h4 className="font-medium">Start VAD</h4>
                  <p className="text-sm text-muted-foreground">
                    Click Start and speak naturally - AI detects speech automatically
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <h4 className="font-medium">Real-time Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    Speech converts to text, then to ASL gloss notation
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <h4 className="font-medium">Sign Animation</h4>
                  <p className="text-sm text-muted-foreground">
                    Watch 3D avatar perform sign language translation
                  </p>
                </div>
              </div>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}
