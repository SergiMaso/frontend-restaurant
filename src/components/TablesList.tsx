import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Ban, Check } from "lucide-react";
import { getTables, updateTableStatus } from "@/services/api";
import { toast } from "sonner";

interface TablesListProps {
  onEdit?: (table: any) => void;
}

const TablesList = ({ onEdit }: TablesListProps = {}) => {
  const queryClient = useQueryClient();

  const { data: tables, isLoading, error } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  // Debug logging
  console.log('🎲 TablesList component:');
  console.log('  Loading:', isLoading);
  console.log('  Error:', error);
  console.log('  Tables data:', tables);
  console.log('  Tables count:', tables?.length || 0);

  const updateStatusMutation = useMutation({
    mutationFn: ({ tableId, status }: { tableId: number; status: string }) =>
      updateTableStatus(tableId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Status de la taula actualitzat");
    },
    onError: (error: Error) => {
      toast.error("Error actualitzant status: " + error.message);
    },
  });

  const handleToggleStatus = (tableId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'available' ? 'unavailable' : 'available';
    updateStatusMutation.mutate({ tableId, status: newStatus });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-success/10 text-success border-success/20";
      case "unavailable":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "occupied":
        return "bg-warning/10 text-warning border-warning/20";
      case "reserved":
        return "bg-accent/10 text-accent border-accent/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Disponible";
      case "unavailable":
        return "No disponible";
      case "occupied":
        return "Ocupada";
      case "reserved":
        return "Reservada";
      default:
        return status;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregant taules...</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables?.map((table) => (
          <div
            key={table.id}
            className="p-4 rounded-lg border border-border bg-card hover:shadow-elegant transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">Mesa {table.table_number}</h3>
                <Badge className={getStatusColor(table.status)}>
                  {getStatusLabel(table.status)}
                </Badge>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {table.capacity}
              </Badge>
            </div>

            <Button
              variant={table.status === 'available' ? 'destructive' : 'default'}
              size="sm"
              onClick={() => handleToggleStatus(table.id, table.status)}
              className="w-full mt-3"
            >
              {table.status === 'available' ? (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Deshabilitar
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Habilitar
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      {tables?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hi ha taules registrades</p>
        </div>
      )}
    </>
  );
};

export default TablesList;
