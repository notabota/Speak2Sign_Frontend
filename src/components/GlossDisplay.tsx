import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface GlossDisplayProps {
  glossText: string;
  isVisible: boolean;
}

export const GlossDisplay: React.FC<GlossDisplayProps> = ({ glossText, isVisible }) => {
  if (!isVisible || !glossText) return null;

  // Split gloss into individual signs for better visual presentation
  const signs = glossText.split(' ').filter(sign => sign.length > 0);

  return (
    <Card className="p-6 bg-gradient-subtle border-2 border-success/20 shadow-soft animate-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Sign Language Translation</h3>
          <div className="flex items-center space-x-2">

            {/* Press the button to represent the animation (later) */}
            <Button variant="outline" size="sm" className="h-8">
              <Eye size={14} className="mr-1" />
              Visual
            </Button>
          </div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex flex-wrap gap-2">
            {signs.map((sign, index) => (
              <Badge
                key={index}
                variant="secondary"
                className={`
                  px-3 py-1 text-sm font-medium bg-primary/10 text-primary
                  animate-in fade-in-0 slide-in-from-bottom-2
                  transition-all duration-300 hover:bg-primary/20
                `}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {sign}
              </Badge>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          <p>Gloss notation represents sign language structure</p>
          <p className="mt-1">• Capital letters = sign concepts • Hyphens = fingerspelling</p>
        </div>

        <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
          <p className="text-sm text-gray-400 text-center font-medium">
           !!!! Visual sign language animation coming soon !!!!!!
          </p>
        </div>
      </div>
    </Card>
  )
};