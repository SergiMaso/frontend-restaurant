import { useState, useEffect } from "react";
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
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState("available");
  const [pairing, setPairing] = useState<number[]>([]);

  useEffect(() => {
    if (mode === 'edit' && table) {
      setTableNumber(table.table_number.toString());
      setCapacity(table.capacity.toString());
      setStatus(table.status);
      setPairing(table.pairing || []);
    } else {
      setTableNumber("");
      setCapacity("");
      setStatus("available");
      setPairing([]);
    }
  }, [table, mode, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: any = {
      table_number: parseInt(tableNumber),
      capacity: parseInt(capacity),
      status,
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
            {mode === 'create' ? 'Crear Nueva Mesa' : `Editar Mesa ${table?.table_number}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Añadir una nueva mesa' 
              : 'Modificar los parametros de la mesa'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="table_number">Número de mesa</Label>
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
            <Label htmlFor="capacity">Capacidad (personas)</Label>
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
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Disponible</SelectItem>
                <SelectItem value="unavailable">No disponible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pairing (combinación con otras mesas)</Label>
            <Select onValueChange={(value) => addPairing(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona mesas para combinar" />
              </SelectTrigger>
              <SelectContent>
                {availableTablesForPairing.map((t) => (
                  <SelectItem 
                    key={t.id} 
                    value={t.table_number.toString()}
                    disabled={pairing.includes(t.table_number)}
                  >
                    Mesa {t.table_number} ({t.capacity} pers.)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {pairing.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {pairing.map((tableNum) => {
                  const pairTable = allTables.find(t => t.table_number === tableNum);
                  return (
                    <Badge key={tableNum} variant="secondary" className="flex items-center gap-1">
                      Mesa {tableNum} {pairTable && `(${pairTable.capacity} pers.)`}
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
              Selecciona las mesas que deseas combinar con esta mesa.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {mode === 'create' ? 'Crear Mesa' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TableDialog;
