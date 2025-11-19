import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
}

const EditCustomerDialog = ({ open, onOpenChange, customer }: EditCustomerDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setPhone(customer.phone || "");
      setLanguage(customer.language || "es");
    }
  }, [customer, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customers/${customer.phone}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('editCustomer.updateError'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(t('editCustomer.updateSuccess'));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t('common.error') + ": " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customers/${customer.phone}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('editCustomer.deleteError'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(t('editCustomer.deleteSuccess'));
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t('common.error') + ": " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t('editCustomer.nameRequired'));
      return;
    }

    if (!phone.trim()) {
      toast.error(t('editCustomer.phoneRequired'));
      return;
    }

    updateMutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
      language: language,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  // Lista completa de idiomas comunes
  const languages = [
    { value: 'ca', label: '🌍 Català', flag: '🌍' },
    { value: 'es', label: '🇪🇸 Español', flag: '🇪🇸' },
    { value: 'en', label: '🇬🇧 English', flag: '🇬🇧' },
    { value: 'fr', label: '🇫🇷 Français', flag: '🇫🇷' },
    { value: 'de', label: '🇩🇪 Deutsch', flag: '🇩🇪' },
    { value: 'it', label: '🇮🇹 Italiano', flag: '🇮🇹' },
    { value: 'pt', label: '🇵🇹 Português', flag: '🇵🇹' },
    { value: 'ru', label: '🇷🇺 Русский', flag: '🇷🇺' },
    { value: 'zh', label: '🇨🇳 中文', flag: '🇨🇳' },
    { value: 'ja', label: '🇯🇵 日本語', flag: '🇯🇵' },
    { value: 'ko', label: '🇰🇷 한국어', flag: '🇰🇷' },
    { value: 'ar', label: '🇸🇦 العربية', flag: '🇸🇦' },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('editCustomer.title')}</DialogTitle>
            <DialogDescription>
              {t('editCustomer.description')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">
                {t('editCustomer.phone')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('editCustomer.phonePlaceholder')}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('editCustomer.phoneWarning')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {t('editCustomer.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('editCustomer.namePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{t('editCustomer.preferredLanguage')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder={t('editCustomer.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('editCustomer.delete')}
              </Button>

              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('editCustomer.cancel')}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t('editCustomer.saving') : t('editCustomer.saveChanges')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editCustomer.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('editCustomer.deleteMessage')}{" "}
              <span className="font-semibold">{name}</span> ({phone}).
              <p className="mt-3 text-destructive font-semibold">
                {t('editCustomer.deleteWarning')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('editCustomer.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t('editCustomer.deleting') : t('editCustomer.yesDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditCustomerDialog;
