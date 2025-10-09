import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: any;
}

const TableDialog = ({ open, onOpenChange, table }: TableDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestió de Taules</DialogTitle>
          <DialogDescription>
            Les taules estan gestionades automàticament pel sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El restaurant té 28 taules configurades automàticament:
          </p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>20 taules de 4 persones (1-20)</li>
            <li>8 taules de 2 persones (21-28)</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Si necessites modificar la configuració, contacta amb l'administrador del sistema.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Tancar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TableDialog;
