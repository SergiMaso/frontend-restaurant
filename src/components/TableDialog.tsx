import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Table } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: Table | null;
  allTables?: Table[];
  onSave: (data: any) => void;
  mode: 'create' | 'edit';
}

const TableDialog = ({
  open,
  onOpenChange,
  table,
  allTables = [],
  onSave,
  mode
}: TableDialogProps) => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState("available");
  const [area, setArea] = useState<"inside" | "terrace">("inside");
  const [pairing, setPairing] = useState<number[]>([]);

  useEffect(() => {
    if (mode === 'edit' && table) {
      setTableNumber(table.table_number.toString());
      setCapacity(table.capacity.toString());
      setStatus(table.status);
      setArea((table.area as "inside" | "terrace") || "inside");
      setPairing(table.pairing || []);
    } else {
      setTableNumber("");
      setCapacity("");
      setStatus("available");
      setArea("inside");
      setPairing([]);
    }
  }, [table, mode, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      table_number: parseInt(tableNumber),
      capacity: parseInt(capacity),
      status,
      area,
      pairing: pairing.length > 0 ? pairing : null,
    };

    onSave(data);
  };

  const addPairing = (tableNum: number) => {
    if (!pairing.includes(tableNum)) {
      setPairing([...pairing, tableNum]);
    }
  };

  const removePairing = (tableNum: number) => {
    setPairing(pairing.filter(t => t !== tableNum));
  };

  // Obtenir taules disponibles per pairing (excloent la taula actual)
  const availableTablesForPairing = allTables.filter(
    t => t.id !== table?.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t("tables.createNew") : t("tables.editTable", { number: table?.table_number })}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? t("tables.addNewTable")
              : t("tables.modifyTableParams")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="table_number">{t("tables.tableNumber")}</Label>
            <Input
              id="table_number"
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              required
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">{t("tables.capacityPeople")}</Label>
            <Input
              id="capacity"
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
              min="1"
              max="12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{tCommon("status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{tCommon("tableStatus.available")}</SelectItem>
                <SelectItem value="unavailable">{tCommon("tableStatus.unavailable")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">{t("reservations.areaPreference")}</Label>
            <Select value={area} onValueChange={(value: "inside" | "terrace") => setArea(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inside">{t("reservations.areaInside")}</SelectItem>
                <SelectItem value="terrace">{t("reservations.areaTerrace")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("tables.pairing")}</Label>
            <Select onValueChange={(value) => addPairing(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder={t("tables.selectTablesToCombine")} />
              </SelectTrigger>
              <SelectContent>
                {availableTablesForPairing.map((tbl) => (
                  <SelectItem
                    key={tbl.id}
                    value={tbl.table_number.toString()}
                    disabled={pairing.includes(tbl.table_number)}
                  >
                    {tCommon("table")} {tbl.table_number} ({tbl.capacity} {t("tables.pers")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {pairing.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {pairing.map((tableNum) => {
                  const pairTable = allTables.find(tbl => tbl.table_number === tableNum);
                  return (
                    <Badge key={tableNum} variant="secondary" className="flex items-center gap-1">
                      {tCommon("table")} {tableNum} {pairTable && `(${pairTable.capacity} ${t("tables.pers")})`}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => removePairing(tableNum)}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("tables.selectTablesHelp")}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit">
              {mode === 'create' ? t("tables.create") : t("tables.saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TableDialog;
