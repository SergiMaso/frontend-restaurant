import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { PhoneInput } from "@/components/ui/phone-input";
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
import { updateCustomer, deleteCustomer } from "@/services/api";
import { useDefaultPhoneCountry } from "@/hooks/useDefaultPhoneCountry";

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
}

const EditCustomerDialog = ({ open, onOpenChange, customer }: EditCustomerDialogProps) => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const defaultCountry = useDefaultPhoneCountry();

  useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setPhone(customer.phone || "");
      setLanguage(customer.language || "es");
    }
  }, [customer, open]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateCustomer(customer.phone, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(t("customers.updateSuccess"));
      onOpenChange(false);
    },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 409) {
        toast.error(t("customers.phoneAlreadyExists"));
        return;
      }
      toast.error(tCommon("error") + ": " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomer(customer.phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(t("customers.deleteSuccess"));
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(tCommon("error") + ": " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t("customers.nameRequired"));
      return;
    }

    if (!phone.trim()) {
      toast.error(t("customers.phoneRequired"));
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
            <DialogTitle>{t("customers.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("customers.editDescription")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">
                {t("customers.phone")} <span className="text-destructive">*</span>
              </Label>
              <PhoneInput
                id="phone"
                value={phone}
                onChange={setPhone}
                defaultCountry={defaultCountry}
                placeholder="600 000 000"
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("customers.phoneChangeWarning")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {t("customers.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("customers.namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{t("customers.preferredLanguage")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder={t("customers.selectLanguage")} />
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
              {/* Botó eliminar a l'esquerra */}
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tCommon("delete")}
              </Button>

              {/* Botons cancel·lar i guardar a la dreta */}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? tCommon("saving") : tCommon("saveChanges")}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diàleg de confirmació per eliminar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("customers.deleteWarning", { name, phone })}
              <p className="mt-3 text-destructive font-semibold">
                {t("customers.deleteConversationsWarning")}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? tCommon("deleting") : tCommon("yesDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditCustomerDialog;
