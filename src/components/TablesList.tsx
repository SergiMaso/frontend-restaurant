import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { getTables } from "@/services/api";

interface TablesListProps {
  onEdit?: (table: any) => void;
}

const TablesList = ({ onEdit }: TablesListProps = {}) => {
  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-success/10 text-success";
      case "occupied":
        return "bg-destructive/10 text-destructive";
      case "reserved":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Disponible";
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
