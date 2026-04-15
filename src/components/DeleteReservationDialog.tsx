import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { getAppointmentPayment, type PaymentRecord } from "@/services/api";

interface DeleteReservationDialogProps {
  open: boolean;
  appointmentId: number | null;
  appointmentName?: string;
  appointmentDate?: string | Date | null;
  appointmentTime?: string | null;
  paymentEnabled?: boolean;
  onConfirm: (refund: boolean) => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

const DeleteReservationDialog = ({
  open,
  appointmentId,
  appointmentName,
  appointmentDate,
  appointmentTime,
  paymentEnabled = false,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteReservationDialogProps) => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const parseAsLocalTime = (timestamp: string): Date => {
    const withoutTz = timestamp.split("+")[0].split("Z")[0];
    return new Date(withoutTz);
  };

  const formattedAppointmentDate = (() => {
    if (!appointmentDate) return "";

    try {
      const date = appointmentDate instanceof Date ? appointmentDate : parseISO(appointmentDate);
      return format(date, "dd/MM/yyyy");
    } catch {
      return typeof appointmentDate === "string" ? appointmentDate : "";
    }
  })();

  const formattedAppointmentTime = (() => {
    if (!appointmentTime) return "";

    try {
      if (/^\d{2}:\d{2}$/.test(appointmentTime)) {
        return appointmentTime;
      }

      return format(parseAsLocalTime(appointmentTime), "HH:mm");
    } catch {
      return appointmentTime;
    }
  })();

  const deleteDescription =
    appointmentName && formattedAppointmentDate && formattedAppointmentTime
      ? t("reservations.confirmDeleteDetail", {
          name: appointmentName,
          date: formattedAppointmentDate,
          time: formattedAppointmentTime,
        })
      : t("reservations.confirmDelete");

  useEffect(() => {
    if (!open || !appointmentId || !paymentEnabled) {
      setPayment(null);
      return;
    }
    setLoadingPayment(true);
    getAppointmentPayment(appointmentId)
      .then(setPayment)
      .catch(() => setPayment(null))
      .finally(() => setLoadingPayment(false));
  }, [open, appointmentId, paymentEnabled]);

  const hasRefundablePayment = payment?.status === "completed" && payment?.refund_eligible;
  const hasPaidDeposit = payment?.status === "completed";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reservations.delete")}</DialogTitle>
          <DialogDescription>{deleteDescription}</DialogDescription>
        </DialogHeader>

        {loadingPayment ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasPaidDeposit ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                {t("payments.depositWarning")}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  {payment!.amount} {payment!.currency}
                </Badge>
                <Badge
                  className={
                    payment!.status === "completed"
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {t(`payments.status.${payment!.status}`)}
                </Badge>
              </div>
              {!hasRefundablePayment && (
                <p className="text-xs text-amber-700">
                  {t("payments.refundWindowExpired")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {hasRefundablePayment && (
                <Button
                  variant="default"
                  onClick={() => onConfirm(true)}
                  disabled={isDeleting}
                  className="w-full"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  {t("payments.cancelAndRefund", {
                    amount: payment!.amount,
                    currency: payment!.currency,
                  })}
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => onConfirm(false)}
                disabled={isDeleting}
                className="w-full"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {t("payments.cancelKeepDeposit")}
              </Button>
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isDeleting}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="destructive"
              onClick={() => onConfirm(false)}
              disabled={isDeleting}
              className="w-full"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {tCommon("delete")}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isDeleting}
              className="w-full"
            >
              {tCommon("cancel")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeleteReservationDialog;
