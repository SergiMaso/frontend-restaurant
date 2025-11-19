import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { forgotPassword } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UtensilsCrossed, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      await forgotPassword({ email });
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || t('forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-elegant">
              <UtensilsCrossed className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t('forgotPassword.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('forgotPassword.description')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {t('forgotPassword.successMessage')}
                </AlertDescription>
              </Alert>
            )}

            {!success && (
              <div className="space-y-2">
                <Label htmlFor="email">{t('forgotPassword.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('forgotPassword.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {!success ? (
              <>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('forgotPassword.sending')}
                    </>
                  ) : (
                    t('forgotPassword.sendInstructions')
                  )}
                </Button>
                <Link to="/login" className="w-full">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('forgotPassword.backToLogin')}
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/login" className="w-full">
                <Button className="w-full">
                  {t('forgotPassword.goToLogin')}
                </Button>
              </Link>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPassword;
