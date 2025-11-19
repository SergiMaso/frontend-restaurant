import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, RotateCw } from "lucide-react";
import { getTables } from "@/services/api";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface TablePosition {
  id: number;
  x: number;
  y: number;
}

const TableLayoutView = () => {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tablePositions, setTablePositions] = useState<TablePosition[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  // Inicialitzar posicions de les taules
  useEffect(() => {
    if (tables && tables.length > 0) {
      // Intentar carregar des de localStorage
      const savedPositions = localStorage.getItem('tablePositions');
      if (savedPositions) {
        try {
          const parsed = JSON.parse(savedPositions);
          // Verificar que totes les taules tinguin posició
          const allTablesHavePosition = tables.every((table: any) =>
            parsed.find((p: TablePosition) => p.id === table.id)
          );
          if (allTablesHavePosition) {
            setTablePositions(parsed);
            return;
          }
        } catch (e) {
          console.error('Error parsing saved positions:', e);
        }
      }

      // Generar posicions per defecte en un grid
      const positions: TablePosition[] = tables.map((table: any, index: number) => {
        const col = index % 6;
        const row = Math.floor(index / 6);
        return {
          id: table.id,
          x: 50 + col * 150,
          y: 50 + row * 150,
        };
      });
      setTablePositions(positions);
      localStorage.setItem('tablePositions', JSON.stringify(positions));
    }
  }, [tables]);

  const getTableColor = (capacity: number) => {
    if (capacity <= 2) return "bg-primary/20 border-primary";
    if (capacity <= 4) return "bg-accent/20 border-accent";
    return "bg-secondary/20 border-secondary";
  };

  const handleMouseDown = (e: React.MouseEvent, tableId: number) => {
    const pos = tablePositions.find(p => p.id === tableId);
    if (!pos) return;

    setDraggingId(tableId);
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingId === null || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(rect.width - 100, e.clientX - rect.left - dragOffset.x));
    const newY = Math.max(0, Math.min(rect.height - 100, e.clientY - rect.top - dragOffset.y));

    setTablePositions(prev =>
      prev.map(p =>
        p.id === draggingId ? { ...p, x: newX, y: newY } : p
      )
    );
  };

  const handleMouseUp = () => {
    if (draggingId !== null) {
      // Guardar posicions a localStorage
      localStorage.setItem('tablePositions', JSON.stringify(tablePositions));
    }
    setDraggingId(null);
  };

  const resetPositions = () => {
    if (!tables) return;

    const positions: TablePosition[] = tables.map((table: any, index: number) => {
      const col = index % 6;
      const row = Math.floor(index / 6);
      return {
        id: table.id,
        x: 50 + col * 150,
        y: 50 + row * 150,
      };
    });
    setTablePositions(positions);
    localStorage.setItem('tablePositions', JSON.stringify(positions));
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{t('layout.loading')}</div>;
  }

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-background" : "relative"}`}>
      <div className="flex justify-between items-center mb-4 p-4">
        <h2 className="text-2xl font-bold">{t('layout.title')}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={resetPositions}
            title={t('layout.resetPositions')}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
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

        {tables?.map((table) => {
          const position = tablePositions.find(p => p.id === table.id);
          if (!position) return null;

          return (
            <div
              key={table.id}
              className={`absolute w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center select-none transition-shadow hover:shadow-lg cursor-move ${getTableColor(
                table.capacity
              )} ${draggingId === table.id ? 'shadow-2xl scale-105 z-10' : ''}`}
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
              }}
              onMouseDown={(e) => handleMouseDown(e, table.id)}
            >
              <div className="text-lg font-bold">T{table.table_number}</div>
              <div className="text-xs text-muted-foreground">{table.capacity} pax</div>
            </div>
          );
        })}

        {(!tables || tables.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            {t('layout.noTables')}
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          {t('layout.dragInfo')}
        </p>
      </div>
    </div>
  );
};

export default TableLayoutView;
