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
  requestFullGloss?: boolean;
}

export default function HomePage() {
  const [vadResult, setVADResult] = useState<VADResult | null>(null);

  const handleVADUpdate = async (result: VADResult) => {
    console.log('VAD update received:', result);

    if (result.transcription || result.gloss || result.sigml) {
      setVADResult(prevResult => {
        const newTranscription = result.transcription ?
          (prevResult?.transcription ? `${prevResult.transcription} ${result.transcription}` : result.transcription) :
          (prevResult?.transcription || '');

        // If we have a new transcription and need full gloss, generate it
        if (result.requestFullGloss && newTranscription) {
          // Trigger async gloss generation for the complete transcription
          setTimeout(() => generateFullGloss(newTranscription), 0);
        }

        return {
          transcription: newTranscription,
          gloss: result.gloss || prevResult?.gloss || '',
          sigml: result.sigml || prevResult?.sigml || ''
        };
      });
    }
  };

  const generateFullGloss = async (fullTranscription: string) => {
    try {
      const glossResponse = await fetch('http://localhost:5000/text-to-gloss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: fullTranscription })
      });

      if (glossResponse.ok) {
        const glossResult = await glossResponse.json();
        const newGloss = glossResult.gloss || '';

        // Update with gloss first
        setVADResult(prevResult => ({
          ...prevResult,
          gloss: newGloss,
          sigml: prevResult?.sigml || ''
        }));

        // Then generate SiGML from the gloss
        if (newGloss) {
          await generateSiGML(newGloss);
        }
      }
    } catch (error) {
      console.error('Failed to generate full gloss:', error);
    }
  };

  const generateSiGML = async (gloss: string) => {
    try {
      const sigmlResponse = await fetch('http://localhost:5000/gloss-to-sigml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gloss: gloss })
      });

      if (sigmlResponse.ok) {
        const sigmlResult = await sigmlResponse.json();
        setVADResult(prevResult => ({
          ...prevResult,
          sigml: sigmlResult.sigml || ''
        }));
      }
    } catch (error) {
      console.error('Failed to generate SiGML:', error);
    }
  };

  const handleClearResults = () => {
    setVADResult(null);
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
                  transcription={vadResult?.transcription || ''}
                  isVisible={true}
                  language="English"
                />

                {/* Gloss Display */}
                <GlossDisplay
                  glossText={vadResult?.gloss || ''}
                  isVisible={true}
                  originalText={vadResult?.transcription}
                />
              </div>
            </div>

            {/* Right Column - Avatar Display */}
            <div className="flex flex-col min-h-0">
              <div className="flex-1 flex items-center justify-center">
                {/* SiGML Display - Always visible */}
                <div className="w-full h-full">
                  <SiGMLDisplay
                    sigml={vadResult?.sigml || ''}
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
