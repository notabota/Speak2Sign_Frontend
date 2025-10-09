"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { MessageSquare, Copy, CheckCircle, Volume2 } from "lucide-react";

interface TranscriptionDisplayProps {
  transcription: string;
  isVisible: boolean;
  language?: string;
}

export function TranscriptionDisplay({
  transcription,
  isVisible,
  language = "English"
}: TranscriptionDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation when transcription changes
  useEffect(() => {
    if (transcription && isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [transcription, isVisible]);

  const handleCopy = async () => {
    if (!transcription) return;

    try {
      await navigator.clipboard.writeText(transcription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleSpeak = () => {
    if (!transcription || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(transcription);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const hasContent = transcription && transcription.trim().length > 0;

  return (
    <Card className={`w-full transition-all duration-300 ${
      isAnimating ? 'scale-[1.02] shadow-md' : 'scale-100'
    } bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-1.5 rounded">
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-blue-900">Transcription</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
              {language}
            </Badge>
            {hasContent ? (
              <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Done
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">
                Waiting...
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Transcription Text */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded border border-blue-100">
          {hasContent ? (
            <p className="text-gray-800 text-sm leading-relaxed">
              "{transcription}"
            </p>
          ) : (
            <p className="text-gray-400 text-sm italic text-center">
              Start speaking to see transcription here...
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-600">
            {hasContent ? (
              `${transcription.split(' ').length} words • ${transcription.length} chars`
            ) : (
              'No transcription yet'
            )}
          </div>

          {hasContent && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSpeak}
                className="border-blue-200 hover:bg-blue-50 h-7 px-2 text-xs"
              >
                <Volume2 className="h-3 w-3 mr-1" />
                Speak
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="border-blue-200 hover:bg-blue-50 h-7 px-2 text-xs"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}