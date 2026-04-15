import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getPayments, refundAppointmentPayment, type PaymentRecord } from "@/services/api";

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  refunded:  "bg-blue-100 text-blue-800 border-blue-200",
  failed:    "bg-red-100 text-red-800 border-red-200",
  expired:   "bg-muted text-muted-foreground",
};

const PaymentsPage = () => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [refundingPayment, setRefundingPayment] = useState<PaymentRecord | null>(null);

  // Debounce search: apply after 400ms of no typing
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
    }, 400);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["payments", page, statusFilter, searchQuery],
    queryFn: () => getPayments(page, statusFilter === "all" ? undefined : statusFilter, searchQuery || undefined),
  });

  const refundMutation = useMutation({
    mutationFn: (appointmentId: number) => refundAppointmentPayment(appointmentId),
    onSuccess: () => {
      toast.success(t("payments.refundSuccess"));
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setRefundingPayment(null);
    },
    onError: (error: Error) => {
      toast.error(t("payments.refundError") + ": " + error.message);
    },
  });

  const formatDate = (isoString: string) => {
    try {
      return format(new Date(isoString.split("T")[0]), "dd/MM/yyyy");
    } catch {
      return isoString;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const without = isoString.split("+")[0].split("Z")[0];
      return new Date(without).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("payments.filterAll")}</SelectItem>
            <SelectItem value="completed">{t("payments.status.completed")}</SelectItem>
            <SelectItem value="refunded">{t("payments.status.refunded")}</SelectItem>
            <SelectItem value="pending">{t("payments.status.pending")}</SelectItem>
            <SelectItem value="expired">{t("payments.status.expired")}</SelectItem>
            <SelectItem value="failed">{t("payments.status.failed")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 w-52"
            placeholder={t("payments.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} {t("payments.totalRecords")}
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("payments.customer")}</TableHead>
                <TableHead>{t("payments.reservation")}</TableHead>
                <TableHead>{t("payments.amount")}</TableHead>
                <TableHead>{t("payments.status.label")}</TableHead>
                <TableHead>{t("payments.reservationStatus")}</TableHead>
                <TableHead>{t("payments.paidOn")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    {t("payments.noPayments")}
                  </TableCell>
                </TableRow>
              )}
              {data?.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div className="font-medium">
                      {payment.appointment.customer_name || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {payment.appointment.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{formatDate(payment.appointment.date)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(payment.appointment.start_time)} · {payment.appointment.num_people} {t("tables.people")}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {payment.amount} {payment.currency}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[payment.status] || ""}>
                      {t(`payments.status.${payment.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {tCommon(`reservationStatus.${payment.appointment.status}`, payment.appointment.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(payment.created_at)}
                  </TableCell>
                  <TableCell>
                    {payment.refund_eligible && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRefundingPayment(payment)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {t("payments.refund")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Refund confirmation dialog */}
      <Dialog open={!!refundingPayment} onOpenChange={(v) => !v && setRefundingPayment(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("payments.refundConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("payments.refundConfirmDesc", {
                amount: refundingPayment?.amount,
                currency: refundingPayment?.currency,
                name: refundingPayment?.appointment.customer_name || refundingPayment?.appointment.phone,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => refundingPayment && refundMutation.mutate(refundingPayment.appointment_id)}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              {t("payments.confirmRefund")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRefundingPayment(null)}
              disabled={refundMutation.isPending}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsPage;
