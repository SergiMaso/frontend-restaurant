import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Send, Eye, Users, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { previewBroadcast, sendBroadcast } from "@/services/api";

const BroadcastManager = () => {
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: previewBroadcast,
    onSuccess: (data) => {
      setPreviewData(data);
      console.log("✅ Preview data:", data);
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (data) => {
      toast.success(`Mensaje enviado a ${data.sent} clientes (${data.failed} errores)`);
      setMessage("");
      setPreviewData(null);
      setConfirmDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const handlePreview = () => {
    if (!message.trim()) {
      toast.error("Escribe un mensaje primero");
      return;
    }

    const data: any = {
      filter_type: filterType,
    };

    if (filterType === 'language' && filterValue) {
      data.filter_value = filterValue;
    }

    previewMutation.mutate(data);
  };

  const handleSendConfirm = () => {
    if (!message.trim()) {
      toast.error("Escribe un mensaje primero");
      return;
    }

    if (!previewData) {
      toast.error("Haz una previsualización primero");
      return;
    }

    setConfirmDialogOpen(true);
  };

  const handleSend = () => {
    const data: any = {
      message: message.trim(),
      filter_type: filterType,
    };

    if (filterType === 'language' && filterValue) {
      data.filter_value = filterValue;
    }

    sendMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Mensaje Difundido
          </CardTitle>
          <CardDescription>
            Envía un mensaje a todos los clientes o un grupo específico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterType">Destinatarios</Label>
              <Select value={filterType} onValueChange={(value) => {
                setFilterType(value);
                setPreviewData(null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona destinatarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Todos los clientes
                    </div>
                  </SelectItem>
                  <SelectItem value="language">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Por idioma
                    </div>
                  </SelectItem>
                  <SelectItem value="recent_customers">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Clientes recientes (últimos 30 días)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterType === 'language' && (
              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select value={filterValue} onValueChange={(value) => {
                  setFilterValue(value);
                  setPreviewData(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ca">🇪🇸 Català</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Missatge */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={6}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              {message.length} caracteres
            </p>
          </div>

          {/* Botons */}
          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              variant="outline"
              disabled={previewMutation.isPending || !message.trim()}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMutation.isPending ? "Cargando..." : "Previsualizar"}
            </Button>
            <Button
              onClick={handleSendConfirm}
              disabled={!previewData || sendMutation.isPending || !message.trim()}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </div>

          {/* Preview data */}
          {previewData && (
            <div className="mt-4 p-4 border border-border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-3">📊 Resumen:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-primary">{previewData.total}</div>
                  <div className="text-xs text-muted-foreground">Total clientes</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{previewData.by_channel?.whatsapp || 0}</div>
                  <div className="text-xs text-muted-foreground">WhatsApp</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{previewData.by_channel?.telegram || 0}</div>
                  <div className="text-xs text-muted-foreground">Telegram</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-sm font-bold flex flex-col gap-1">
                    {previewData.by_language && Object.entries(previewData.by_language).map(([lang, count]: [string, any]) => (
                      <div key={lang}>
                        <Badge variant="outline">{lang.toUpperCase()}: {count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Llista de destinataris (scroll) */}
              <div className="mt-4 max-h-48 overflow-y-auto">
                <h5 className="text-sm font-semibold mb-2">Destinatarios:</h5>
                <div className="space-y-1">
                  {previewData.recipients?.slice(0, 20).map((recipient: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-background rounded flex items-center justify-between">
                      <span className="font-medium">{recipient.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{recipient.language}</Badge>
                        <Badge variant="secondary" className="text-xs">{recipient.channel}</Badge>
                      </div>
                    </div>
                  ))}
                  {previewData.recipients?.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      ... y {previewData.recipients.length - 20} más
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diàleg de confirmació */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envío</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de enviar este mensaje a <strong>{previewData?.total || 0} clientes</strong>.
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Mensaje:</p>
                <p className="text-sm whitespace-pre-wrap">{message}</p>
              </div>
              <p className="mt-4 text-destructive font-semibold">
                ⚠️ Esta acción no se puede deshacer
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="bg-primary"
            >
              {sendMutation.isPending ? "Enviando..." : "Sí, enviar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BroadcastManager;
