import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

interface DraggedTable {
  id: string;
  offsetX: number;
  offsetY: number;
}

const TableLayoutView = () => {
  const [draggedTable, setDraggedTable] = useState<DraggedTable | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .order("table_number");
      if (error) throw error;
      return data;
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) => {
      const { error } = await supabase
        .from("tables")
        .update({ position_x: x, position_y: y })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Posición actualizada");
    },
  });

  const handleMouseDown = (e: React.MouseEvent, table: any) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDraggedTable({
      id: table.id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedTable || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - containerRect.left - draggedTable.offsetX, containerRect.width - 100));
    const y = Math.max(0, Math.min(e.clientY - containerRect.top - draggedTable.offsetY, containerRect.height - 100));

    const tableElement = document.getElementById(`table-${draggedTable.id}`);
    if (tableElement) {
      tableElement.style.left = `${x}px`;
      tableElement.style.top = `${y}px`;
    }
  };

  const handleMouseUp = () => {
    if (!draggedTable || !containerRef.current) {
      setDraggedTable(null);
      return;
    }

    const tableElement = document.getElementById(`table-${draggedTable.id}`);
    if (tableElement) {
      const x = parseInt(tableElement.style.left);
      const y = parseInt(tableElement.style.top);
      updatePositionMutation.mutate({ id: draggedTable.id, x, y });
    }

    setDraggedTable(null);
  };

  const getTableColor = (capacity: number) => {
    if (capacity <= 2) return "bg-primary/20 border-primary";
    if (capacity <= 4) return "bg-accent/20 border-accent";
    return "bg-secondary/20 border-secondary";
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-background" : "relative"}`}>
      <div className="flex justify-between items-center mb-4 p-4">
        <h2 className="text-2xl font-bold">Disposición de Mesas</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div
        ref={containerRef}
        className={`relative bg-muted/20 border-2 border-dashed border-border rounded-lg overflow-hidden ${
          isFullscreen ? "h-[calc(100vh-100px)]" : "h-[600px]"
        }`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--border)_/_0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--border)_/_0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />
        
        {tables?.map((table) => (
          <div
            key={table.id}
            id={`table-${table.id}`}
            className={`absolute w-24 h-24 rounded-lg border-2 cursor-move transition-all hover:shadow-lg flex flex-col items-center justify-center select-none ${getTableColor(
              table.capacity
            )} ${draggedTable?.id === table.id ? "opacity-70 scale-110 z-50" : "z-10"}`}
            style={{
              left: `${table.position_x || 100}px`,
              top: `${table.position_y || 100}px`,
            }}
            onMouseDown={(e) => handleMouseDown(e, table)}
          >
            <div className="text-lg font-bold">T{table.table_number}</div>
            <div className="text-xs text-muted-foreground">{table.capacity} pax</div>
            {table.location && (
              <div className="text-[10px] text-muted-foreground truncate max-w-full px-1">
                {table.location}
              </div>
            )}
          </div>
        ))}

        {!tables || tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            No hay mesas configuradas. Añade mesas primero.
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Arrastra las mesas para organizarlas según el layout de tu restaurante.
          Las posiciones se guardan automáticamente.
        </p>
      </div>
    </div>
  );
};

export default TableLayoutView;
