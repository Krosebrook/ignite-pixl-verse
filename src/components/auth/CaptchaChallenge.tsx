import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface CaptchaChallenge {
  question: string;
  answer: number;
  type: "math" | "word";
}

interface CaptchaChallengeProps {
  onVerified: () => void;
  onCancel?: () => void;
  className?: string;
}

// Generate a random math CAPTCHA
const generateMathCaptcha = (): CaptchaChallenge => {
  const operations = ["+", "-", "×"];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let num1: number, num2: number, answer: number;
  
  switch (operation) {
    case "+":
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 + num2;
      break;
    case "-":
      num1 = Math.floor(Math.random() * 20) + 10;
      num2 = Math.floor(Math.random() * 10) + 1;
      answer = num1 - num2;
      break;
    case "×":
      num1 = Math.floor(Math.random() * 10) + 1;
      num2 = Math.floor(Math.random() * 10) + 1;
      answer = num1 * num2;
      break;
    default:
      num1 = 5;
      num2 = 3;
      answer = 8;
  }
  
  return {
    question: `${num1} ${operation} ${num2} = ?`,
    answer,
    type: "math",
  };
};

// Generate word-based CAPTCHA (count specific letters)
const generateWordCaptcha = (): CaptchaChallenge => {
  const words = [
    { word: "SECURITY", letter: "S", count: 1 },
    { word: "FLASHFUSION", letter: "F", count: 2 },
    { word: "PROTECTION", letter: "O", count: 2 },
    { word: "VERIFICATION", letter: "I", count: 3 },
    { word: "AUTHENTICATION", letter: "A", count: 2 },
    { word: "CAPTCHA", letter: "A", count: 2 },
  ];
  
  const selected = words[Math.floor(Math.random() * words.length)];
  
  return {
    question: `How many "${selected.letter}"s are in "${selected.word}"?`,
    answer: selected.count,
    type: "word",
  };
};

export function CaptchaChallenge({ onVerified, onCancel, className }: CaptchaChallengeProps) {
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [verified, setVerified] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Generate new CAPTCHA
  const generateNewCaptcha = useCallback(() => {
    // Alternate between math and word captchas
    const newCaptcha = Math.random() > 0.5 ? generateMathCaptcha() : generateWordCaptcha();
    setCaptcha(newCaptcha);
    setUserAnswer("");
    setError(false);
  }, []);

  // Initialize CAPTCHA on mount
  useEffect(() => {
    generateNewCaptcha();
  }, [generateNewCaptcha]);

  const handleVerify = () => {
    if (!captcha) return;
    
    const answer = parseInt(userAnswer, 10);
    
    if (answer === captcha.answer) {
      setVerified(true);
      setError(false);
      // Small delay to show success state
      setTimeout(() => {
        onVerified();
      }, 500);
    } else {
      setError(true);
      setAttempts((prev) => prev + 1);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      
      // Generate new CAPTCHA after 3 wrong attempts
      if (attempts >= 2) {
        setTimeout(() => {
          generateNewCaptcha();
          setAttempts(0);
        }, 1000);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVerify();
    }
  };

  if (!captcha) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <Alert className={cn(
        "border-2 transition-all duration-300",
        verified ? "bg-success/10 border-success/50" : "bg-muted/50 border-primary/30",
        isShaking && "animate-shake"
      )}>
        <div className="flex items-start gap-3">
          {verified ? (
            <ShieldCheck className="h-5 w-5 text-success mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-primary mt-0.5" />
          )}
          <div className="flex-1 space-y-3">
            <AlertDescription className="text-sm">
              {verified ? (
                <span className="font-medium text-success">Verification successful!</span>
              ) : (
                <>
                  <span className="font-medium">Security verification required.</span>
                  <br />
                  <span className="text-muted-foreground">
                    Too many failed attempts. Please solve the challenge below.
                  </span>
                </>
              )}
            </AlertDescription>

            {!verified && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-background/80 rounded-lg p-3 text-center border border-border">
                    <span className="text-lg font-mono font-bold tracking-wider">
                      {captcha.question}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={generateNewCaptcha}
                    className="h-10 w-10 shrink-0"
                    title="Generate new challenge"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="captcha-answer" className="text-xs text-muted-foreground">
                    Your answer
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="captcha-answer"
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Enter your answer"
                      value={userAnswer}
                      onChange={(e) => {
                        setUserAnswer(e.target.value);
                        setError(false);
                      }}
                      onKeyDown={handleKeyDown}
                      className={cn(
                        "bg-background border-border",
                        error && "border-destructive focus-visible:ring-destructive"
                      )}
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={handleVerify}
                      disabled={!userAnswer}
                      className="shrink-0"
                    >
                      Verify
                    </Button>
                  </div>
                  {error && (
                    <p className="text-xs text-destructive">
                      Incorrect answer. {attempts >= 2 ? "New challenge loading..." : `${3 - attempts} attempts remaining.`}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Alert>

      {onCancel && !verified && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="w-full text-muted-foreground"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
