import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Key, 
  HelpCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Shield,
  Loader2,
  Download,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BackupCode {
  code: string;
  used: boolean;
  used_at?: string;
}

interface SecurityQuestion {
  question: string;
  answer_hash: string;
}

interface AccountRecoveryProps {
  className?: string;
}

// Security questions options
const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was your childhood nickname?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What was the make of your first car?",
  "What is your favorite movie?",
  "What is the name of the street you grew up on?",
  "What was your favorite food as a child?",
  "What is your favorite book?",
];

// Generate random backup codes
const generateBackupCodes = (count: number = 8): BackupCode[] => {
  const codes: BackupCode[] = [];
  for (let i = 0; i < count; i++) {
    const code = Array.from({ length: 8 }, () => 
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
    ).join("");
    const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;
    codes.push({ code: formattedCode, used: false });
  }
  return codes;
};

// Simple hash for security question answers (in production, use bcrypt on server)
const hashAnswer = async (answer: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(answer.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function AccountRecovery({ className }: AccountRecoveryProps) {
  const [activeTab, setActiveTab] = useState("backup-codes");
  const [backupCodes, setBackupCodes] = useState<BackupCode[]>([]);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasBackupCodes, setHasBackupCodes] = useState(false);
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false);

  // Form state for security questions
  const [question1, setQuestion1] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [question2, setQuestion2] = useState("");
  const [answer2, setAnswer2] = useState("");

  useEffect(() => {
    fetchRecoveryOptions();
  }, []);

  const fetchRecoveryOptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch backup codes
      const { data: backupData } = await supabase
        .from("backup_codes")
        .select("codes")
        .eq("user_id", user.id)
        .single();

      if (backupData?.codes) {
        const codes = backupData.codes as unknown as BackupCode[];
        setBackupCodes(codes);
        setHasBackupCodes(codes.some((c) => !c.used));
      }

      // Fetch security questions
      const { data: questionsData } = await supabase
        .from("security_questions")
        .select("questions")
        .eq("user_id", user.id)
        .single();

      if (questionsData?.questions) {
        const questions = questionsData.questions as unknown as SecurityQuestion[];
        setSecurityQuestions(questions);
        setHasSecurityQuestions(questions.length >= 2);
        if (questions[0]) setQuestion1(questions[0].question);
        if (questions[1]) setQuestion2(questions[1].question);
      }
    } catch (error) {
      console.error("Error fetching recovery options:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewBackupCodes = async () => {
    setGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newCodes = generateBackupCodes(8);

      // Upsert backup codes
      const { error } = await supabase
        .from("backup_codes")
        .upsert([{
          user_id: user.id,
          codes: JSON.parse(JSON.stringify(newCodes)),
          updated_at: new Date().toISOString(),
        }], {
          onConflict: "user_id",
        });

      if (error) throw error;

      setBackupCodes(newCodes);
      setHasBackupCodes(true);
      setShowCodes(true);
      toast.success("New backup codes generated!");
    } catch (error) {
      console.error("Error generating backup codes:", error);
      toast.error("Failed to generate backup codes");
    } finally {
      setGenerating(false);
    }
  };

  const saveSecurityQuestions = async () => {
    if (!question1 || !answer1 || !question2 || !answer2) {
      toast.error("Please fill in both questions and answers");
      return;
    }

    if (question1 === question2) {
      toast.error("Please select two different questions");
      return;
    }

    if (answer1.trim().length < 2 || answer2.trim().length < 2) {
      toast.error("Answers must be at least 2 characters");
      return;
    }

    setSavingQuestions(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const questions: SecurityQuestion[] = [
        { question: question1, answer_hash: await hashAnswer(answer1) },
        { question: question2, answer_hash: await hashAnswer(answer2) },
      ];

      const { error } = await supabase
        .from("security_questions")
        .upsert([{
          user_id: user.id,
          questions: JSON.parse(JSON.stringify(questions)),
          updated_at: new Date().toISOString(),
        }], {
          onConflict: "user_id",
        });

      if (error) throw error;

      setSecurityQuestions(questions);
      setHasSecurityQuestions(true);
      setAnswer1("");
      setAnswer2("");
      toast.success("Security questions saved!");
    } catch (error) {
      console.error("Error saving security questions:", error);
      toast.error("Failed to save security questions");
    } finally {
      setSavingQuestions(false);
    }
  };

  const copyAllCodes = async () => {
    const codesText = backupCodes
      .filter((c) => !c.used)
      .map((c) => c.code)
      .join("\n");
    
    await navigator.clipboard.writeText(codesText);
    setCopied(true);
    toast.success("Codes copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCodes = () => {
    const codesText = `FlashFusion Backup Codes
Generated: ${new Date().toLocaleString()}

Keep these codes in a safe place. Each code can only be used once.

${backupCodes.map((c, i) => `${i + 1}. ${c.code}${c.used ? " (used)" : ""}`).join("\n")}

If you lose access to your account, you can use one of these codes to recover it.
`;

    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flashfusion-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup codes downloaded");
  };

  const unusedCodesCount = backupCodes.filter((c) => !c.used).length;

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Account Recovery</CardTitle>
            <CardDescription>
              Set up recovery options in case you lose access
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="backup-codes" className="gap-2">
                <Key className="h-4 w-4" />
                Backup Codes
                {hasBackupCodes && (
                  <Badge variant="secondary" className="h-5 text-xs">
                    {unusedCodesCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="security-questions" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Security Questions
                {hasSecurityQuestions && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* Backup Codes Tab */}
            <TabsContent value="backup-codes" className="space-y-4 mt-4">
              <Alert className="bg-muted/50">
                <Key className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Backup codes let you access your account if you can't use your normal sign-in methods. Each code can only be used once.
                </AlertDescription>
              </Alert>

              {backupCodes.length > 0 ? (
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {unusedCodesCount} of {backupCodes.length} codes remaining
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Store these in a secure location
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCodes(!showCodes)}
                      >
                        {showCodes ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-1" />
                            Show
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Codes Grid */}
                  {showCodes && (
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, index) => (
                        <div
                          key={index}
                          className={cn(
                            "p-2 rounded-md font-mono text-sm text-center",
                            code.used
                              ? "bg-muted/30 text-muted-foreground line-through"
                              : "bg-muted/50 border border-border"
                          )}
                        >
                          {code.code}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {showCodes && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyAllCodes}
                        className="flex-1"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy All
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadCodes}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  )}

                  {/* Regenerate */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        disabled={generating}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate New Codes
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Generate new backup codes?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will invalidate all existing backup codes. Make sure to save your new codes in a secure location.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={generateNewBackupCodes}>
                          Generate New Codes
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {unusedCodesCount <= 2 && unusedCodesCount > 0 && (
                    <Alert className="bg-amber-500/10 border-amber-500/30">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="text-sm">
                        You're running low on backup codes. Consider generating new ones soon.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Key className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground mb-4">
                    You haven't set up backup codes yet
                  </p>
                  <Button onClick={generateNewBackupCodes} disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        Generate Backup Codes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Security Questions Tab */}
            <TabsContent value="security-questions" className="space-y-4 mt-4">
              <Alert className="bg-muted/50">
                <HelpCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Security questions help verify your identity when recovering your account. Choose questions only you can answer.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {/* Question 1 */}
                <div className="space-y-2">
                  <Label>Question 1</Label>
                  <Select value={question1} onValueChange={setQuestion1}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a security question" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECURITY_QUESTIONS.filter(q => q !== question2).map((q) => (
                        <SelectItem key={q} value={q}>
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Your answer"
                    value={answer1}
                    onChange={(e) => setAnswer1(e.target.value)}
                    disabled={!question1}
                  />
                </div>

                {/* Question 2 */}
                <div className="space-y-2">
                  <Label>Question 2</Label>
                  <Select value={question2} onValueChange={setQuestion2}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a security question" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECURITY_QUESTIONS.filter(q => q !== question1).map((q) => (
                        <SelectItem key={q} value={q}>
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Your answer"
                    value={answer2}
                    onChange={(e) => setAnswer2(e.target.value)}
                    disabled={!question2}
                  />
                </div>

                <Button
                  onClick={saveSecurityQuestions}
                  disabled={savingQuestions || !question1 || !answer1 || !question2 || !answer2}
                  className="w-full"
                >
                  {savingQuestions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : hasSecurityQuestions ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Update Security Questions
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Security Questions
                    </>
                  )}
                </Button>

                {hasSecurityQuestions && (
                  <Alert className="bg-green-500/10 border-green-500/30">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-sm">
                      Security questions are set up. You can use them to recover your account.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
