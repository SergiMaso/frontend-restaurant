import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { getTables } from "@/services/api";
import { useState, useRef } from "react";

const TableLayoutView = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const getTableColor = (capacity: number) => {
    if (capacity <= 2) return "bg-primary/20 border-primary";
    if (capacity <= 4) return "bg-accent/20 border-accent";
    return "bg-secondary/20 border-secondary";
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregant...</div>;
  }

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-background" : "relative"}`}>
      <div className="flex justify-between items-center mb-4 p-4">
        <h2 className="text-2xl font-bold">Disposició de Taules</h2>
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
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--border)_/_0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--border)_/_0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />
        
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-8">
          {tables?.map((table, index) => (
            <div
              key={table.id}
              className={`w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center select-none transition-all hover:shadow-lg ${getTableColor(
                table.capacity
              )}`}
            >
              <div className="text-lg font-bold">T{table.table_number}</div>
              <div className="text-xs text-muted-foreground">{table.capacity} pax</div>
            </div>
          ))}
        </div>

        {!tables || tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            No hi ha taules configurades.
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          💡 Vista de totes les taules del restaurant organitzades per capacitat.
        </p>
      </div>
    </div>
  );
};

export default TableLayoutView;
