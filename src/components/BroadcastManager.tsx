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
import { useTranslation } from "react-i18next";

const BroadcastManager = () => {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/broadcast/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('broadcast.previewError'));
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      console.log("✅ Preview data:", data);
    },
    onError: (error: Error) => {
      toast.error(t('common.error') + ": " + error.message);
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('broadcast.sendError'));
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(t('broadcast.messageSent', { sent: data.sent, failed: data.failed }));
      setMessage("");
      setPreviewData(null);
      setConfirmDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(t('common.error') + ": " + error.message);
    },
  });

  const handlePreview = () => {
    if (!message.trim()) {
      toast.error(t('broadcast.writeMessageFirst'));
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
      toast.error(t('broadcast.writeMessageFirst'));
      return;
    }

    if (!previewData) {
      toast.error(t('broadcast.previewFirst'));
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
            {t('broadcast.title')}
          </CardTitle>
          <CardDescription>
            {t('broadcast.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterType">{t('broadcast.recipients')}</Label>
              <Select value={filterType} onValueChange={(value) => {
                setFilterType(value);
                setPreviewData(null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('broadcast.selectRecipients')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('broadcast.allCustomers')}
                    </div>
                  </SelectItem>
                  <SelectItem value="language">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {t('broadcast.byLanguage')}
                    </div>
                  </SelectItem>
                  <SelectItem value="recent_customers">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {t('broadcast.recentCustomers')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterType === 'language' && (
              <div className="space-y-2">
                <Label htmlFor="language">{t('broadcast.language')}</Label>
                <Select value={filterValue} onValueChange={(value) => {
                  setFilterValue(value);
                  setPreviewData(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('broadcast.selectLanguage')} />
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

          <div className="space-y-2">
            <Label htmlFor="message">{t('broadcast.message')}</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('broadcast.messagePlaceholder')}
              rows={6}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              {message.length} {t('broadcast.characters')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              variant="outline"
              disabled={previewMutation.isPending || !message.trim()}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMutation.isPending ? t('broadcast.loading') : t('broadcast.preview')}
            </Button>
            <Button
              onClick={handleSendConfirm}
              disabled={!previewData || sendMutation.isPending || !message.trim()}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {t('broadcast.send')}
            </Button>
          </div>

          {previewData && (
            <div className="mt-4 p-4 border border-border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-3">{t('broadcast.summary')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-primary">{previewData.total}</div>
                  <div className="text-xs text-muted-foreground">{t('broadcast.totalCustomers')}</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{previewData.by_channel?.whatsapp || 0}</div>
                  <div className="text-xs text-muted-foreground">{t('broadcast.whatsapp')}</div>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{previewData.by_channel?.telegram || 0}</div>
                  <div className="text-xs text-muted-foreground">{t('broadcast.telegram')}</div>
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

              <div className="mt-4 max-h-48 overflow-y-auto">
                <h5 className="text-sm font-semibold mb-2">{t('broadcast.recipientsList')}</h5>
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
                      {t('broadcast.andMore', { count: previewData.recipients.length - 20 })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('broadcast.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('broadcast.confirmDescription')} <strong>{previewData?.total || 0} {t('broadcast.customers')}</strong>.
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">{t('broadcast.messageLabel')}</p>
                <p className="text-sm whitespace-pre-wrap">{message}</p>
              </div>
              <p className="mt-4 text-destructive font-semibold">
                {t('broadcast.confirmWarning')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('broadcast.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="bg-primary"
            >
              {sendMutation.isPending ? t('broadcast.sending') : t('broadcast.yesSend')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BroadcastManager;
