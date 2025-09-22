import React, { useState } from 'react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { GlossDisplay } from '@/components/GlossDisplay';
import { Card } from '@/components/ui/card';
import { Accessibility, Mic, Languages } from 'lucide-react';

const Index = () => {
  const [currentGloss, setCurrentGloss] = useState<string>('');
  const [showGloss, setShowGloss] = useState<boolean>(false);

  const handleGlossGenerated = (gloss: string) => {
    setCurrentGloss(gloss);
    setShowGloss(true);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="bg-blue-950 p-3 rounded-full">
                <Accessibility className="h-8 w-8 text-orange-500" />
              </div>
              <h1 className="text-4xl font-bold bg-clip-text text-blue-900">
                SignBridge AI
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-xl mx-auto">
              Breaking communication barriers with AI-powered voice to sign language translation
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 text-center bg-card/50 backdrop-blur-sm">
              <Mic className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Voice Recognition</h3>
              <p className="text-sm text-muted-foreground">
                Advanced AI processes your speech in real-time
              </p>
            </Card>
            
            <Card className="p-6 text-center bg-card/50 backdrop-blur-sm">
              <Languages className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Instant Translation</h3>
              <p className="text-sm text-muted-foreground">
                Converts speech to sign language gloss notation
              </p>
            </Card>
            
            <Card className="p-6 text-center bg-card/50 backdrop-blur-sm">
              <Accessibility className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Accessibility First</h3>
              <p className="text-sm text-muted-foreground">
                Designed to empower the deaf and hard-of-hearing community
              </p>
            </Card>
          </div>

          {/* Voice Recorder */}
          <VoiceRecorder onGlossGenerated={handleGlossGenerated} />

          {/* Gloss Display */}
          <GlossDisplay 
            glossText={currentGloss} 
            isVisible={showGloss}
          />

          {/* Info Section */}
          <Card className="p-8 bg-card/30 backdrop-blur-sm text-center">
            <h3 className="text-2xl font-semibold mb-4">How It Works</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h4 className="font-medium">Speak Naturally</h4>
                <p className="text-sm text-muted-foreground">
                  Click record and speak normally into your device's microphone
                </p>
              </div>
              <div className="space-y-2">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-primary font-bold">2</span>
                </div>
                <h4 className="font-medium">AI Processing</h4>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes your speech and converts it to sign language
                </p>
              </div>
              <div className="space-y-2">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-primary font-bold">3</span>
                </div>
                <h4 className="font-medium">Visual Output</h4>
                <p className="text-sm text-muted-foreground">
                  Get instant gloss notation and visual sign language representation
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;