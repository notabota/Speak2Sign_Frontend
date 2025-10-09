"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { HandMetal, Copy, CheckCircle, Lightbulb, ArrowRight } from "lucide-react";

interface GlossDisplayProps {
  glossText: string;
  isVisible: boolean;
  originalText?: string;
}

export function GlossDisplay({
  glossText,
  isVisible,
  originalText
}: GlossDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation when gloss changes
  useEffect(() => {
    if (glossText && isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [glossText, isVisible]);

  const handleCopy = async () => {
    if (!glossText) return;

    try {
      await navigator.clipboard.writeText(glossText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy gloss:', err);
    }
  };

  const hasContent = glossText && glossText.trim().length > 0;
  // Split gloss into individual signs for better visual presentation
  const signs = hasContent ? glossText.split(' ').filter(sign => sign.length > 0) : [];

  return (
    <Card className={`w-full transition-all duration-300 ${
      isAnimating ? 'scale-[1.02] shadow-md' : 'scale-100'
    } bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-1.5 rounded">
              <HandMetal className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-purple-900">ASL Gloss</span>
          </div>
          <div className="flex items-center gap-1">
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
        {/* Gloss Signs Display */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded border border-purple-100">
          {hasContent ? (
            <div className="flex flex-wrap gap-2">
              {signs.map((sign, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="px-2 py-1 text-sm font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 transition-all duration-300 cursor-default"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {sign}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic text-center">
              ASL gloss translation will appear here...
            </p>
          )}
        </div>

        {/* Statistics and Actions */}
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-600">
            {hasContent ? (
              `${signs.length} signs • ${glossText.length} chars`
            ) : (
              'No gloss translation yet'
            )}
          </div>

          {hasContent && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="border-purple-200 hover:bg-purple-50 h-7 px-2 text-xs"
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
