import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UtensilsCrossed, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Obtenir token de la URL
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validacions
    if (!token) {
      setError("Token no vàlid");
      return;
    }

    if (password.length < 6) {
      setError("La contrasenya ha de tenir mínim 6 caràcters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les contrasenyes no coincideixen");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({
        token,
        new_password: password,
      });

      toast({
        title: "Contrasenya actualitzada!",
        description: "Ara ja pots iniciar sessió amb la teva nova contrasenya.",
      });

      // Redirigir a login
      navigate("/login");
    } catch (error: any) {
      setError(error.message || "Error resetejant la contrasenya");
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
          <CardTitle className="text-2xl text-center">Nova Contrasenya</CardTitle>
          <CardDescription className="text-center">
            Introdueix la teva nova contrasenya
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

            {!token && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Token de recuperació no vàlid o expirat.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Nova Contrasenya</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínim 6 caràcters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || !token}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contrasenya</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeteix la contrasenya"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading || !token}
              />
            </div>

            {token && (
              <Alert className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Token vàlid. Pots establir la teva nova contrasenya.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !token}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualitzant...
                </>
              ) : (
                "Actualitzar Contrasenya"
              )}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Recordes la contrasenya?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Inicia sessió
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
