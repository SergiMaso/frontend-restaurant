import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Maximize2, Minimize2, RotateCw, Lock, Unlock, Undo2, Redo2, Pencil, Square, Circle, Trash2, X } from "lucide-react";
import { getTables } from "@/services/api";
import { useState, useRef, useEffect, useCallback } from "react";

interface TablePosition {
  id: number;
  x: number;
  y: number;
  shape?: 'round' | 'square';
}

interface WallLine {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface LayoutState {
  positions: TablePosition[];
  walls: WallLine[];
}

const MAX_HISTORY = 50;
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;

const TableLayoutView = () => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tablePositions, setTablePositions] = useState<TablePosition[]>([]);
  const [walls, setWalls] = useState<WallLine[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingWallId, setDraggingWallId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentWall, setCurrentWall] = useState<{ startX: number; startY: number } | null>(null);
  const [tempWallEnd, setTempWallEnd] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<LayoutState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [scale, setScale] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isDraggingWallRef = useRef(false);

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  // Load saved layout
  useEffect(() => {
    if (tables && tables.length > 0) {
      const savedLayout = localStorage.getItem('tableLayout');
      if (savedLayout) {
        try {
          const parsed = JSON.parse(savedLayout);
          const allTablesHavePosition = tables.every((table: any) =>
            parsed.positions?.find((p: TablePosition) => p.id === table.id)
          );
          if (allTablesHavePosition) {
            setTablePositions(parsed.positions);
            setWalls(parsed.walls || []);
            setScale(parsed.scale || 100);
            setHistory([{ positions: parsed.positions, walls: parsed.walls || [] }]);
            setHistoryIndex(0);
            return;
          }
        } catch (e) {
          console.error('Error parsing saved layout:', e);
        }
      }

      const positions = generateDefaultPositions(tables);
      setTablePositions(positions);
      setWalls([]);
      setHistory([{ positions, walls: [] }]);
      setHistoryIndex(0);
      saveLayout(positions, [], 100);
    }
  }, [tables]);

  const generateDefaultPositions = (tablesData: any[]): TablePosition[] => {
    return tablesData.map((table: any, index: number) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      return {
        id: table.id,
        x: 60 + col * 160,
        y: 60 + row * 160,
        shape: undefined,
      };
    });
  };

  const saveLayout = (positions: TablePosition[], wallLines: WallLine[], scaleValue: number) => {
    localStorage.setItem('tableLayout', JSON.stringify({
      positions,
      walls: wallLines,
      scale: scaleValue,
    }));
  };

  // Get table size based on capacity and scale
  const getTableSize = (capacity: number) => {
    const scaleFactor = scale / 100;
    let base;
    if (capacity <= 2) base = { width: 70, height: 70 };
    else if (capacity <= 4) base = { width: 90, height: 90 };
    else if (capacity <= 6) base = { width: 110, height: 110 };
    else base = { width: 130, height: 90 };

    return {
      width: Math.round(base.width * scaleFactor),
      height: Math.round(base.height * scaleFactor),
    };
  };

  const getTableColor = (capacity: number) => {
    if (capacity <= 2) return "bg-blue-500/20 border-blue-500";
    if (capacity <= 4) return "bg-green-500/20 border-green-500";
    if (capacity <= 6) return "bg-amber-500/20 border-amber-500";
    return "bg-purple-500/20 border-purple-500";
  };

  const getTableShape = (tablePos: TablePosition, capacity: number) => {
    if (tablePos.shape === 'round') return "rounded-full";
    if (tablePos.shape === 'square') return "rounded-lg";
    if (capacity <= 2) return "rounded-full";
    return "rounded-lg";
  };

  // Toggle table shape
  const toggleTableShape = (tableId: number) => {
    if (isLocked || isDrawingMode) return;

    setTablePositions(prev => {
      const newPositions = prev.map(p => {
        if (p.id === tableId) {
          const currentShape = p.shape || 'round';
          return { ...p, shape: currentShape === 'round' ? 'square' as const : 'round' as const };
        }
        return p;
      });
      saveToHistory({ positions: newPositions, walls });
      saveLayout(newPositions, walls, scale);
      return newPositions;
    });
  };

  // Save to history
  const saveToHistory = useCallback((newState: LayoutState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setTablePositions(history[newIndex].positions);
      setWalls(history[newIndex].walls);
      saveLayout(history[newIndex].positions, history[newIndex].walls, scale);
    }
  }, [history, historyIndex, scale]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setTablePositions(history[newIndex].positions);
      setWalls(history[newIndex].walls);
      saveLayout(history[newIndex].positions, history[newIndex].walls, scale);
    }
  }, [history, historyIndex, scale]);

  // Get position from mouse or touch event
  const getEventPosition = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY };
  };

  // Get position relative to container
  const getRelativePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Handle table drag start
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, tableId: number) => {
    if (isLocked || isDrawingMode) return;

    e.preventDefault();
    e.stopPropagation();
    const pos = tablePositions.find(p => p.id === tableId);
    if (!pos || !containerRef.current) return;

    const { clientX, clientY } = getEventPosition(e);
    const rect = containerRef.current.getBoundingClientRect();

    setDraggingId(tableId);
    isDraggingRef.current = true;
    setDragOffset({
      x: clientX - rect.left - pos.x,
      y: clientY - rect.top - pos.y,
    });
  };

  // Handle wall drag start
  const handleWallDragStart = (e: React.MouseEvent | React.TouchEvent, wallId: string) => {
    if (isLocked || isDrawingMode) return;

    e.preventDefault();
    e.stopPropagation();
    const wall = walls.find(w => w.id === wallId);
    if (!wall || !containerRef.current) return;

    const { clientX, clientY } = getEventPosition(e);
    const rect = containerRef.current.getBoundingClientRect();

    // Calculate center of wall for offset
    const centerX = (wall.startX + wall.endX) / 2;
    const centerY = (wall.startY + wall.endY) / 2;

    setDraggingWallId(wallId);
    isDraggingWallRef.current = true;
    setDragOffset({
      x: clientX - rect.left - centerX,
      y: clientY - rect.top - centerY,
    });
  };

  // Handle drag move for tables
  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!isDraggingRef.current || draggingId === null || !containerRef.current) return;

    e.preventDefault();
    const { clientX, clientY } = getEventPosition(e);
    const rect = containerRef.current.getBoundingClientRect();

    const table = tables?.find((t: any) => t.id === draggingId);
    const size = table ? getTableSize(table.capacity) : { width: 90, height: 90 };

    const newX = Math.max(0, Math.min(CANVAS_WIDTH - size.width, clientX - rect.left - dragOffset.x));
    const newY = Math.max(0, Math.min(CANVAS_HEIGHT - size.height, clientY - rect.top - dragOffset.y));

    setTablePositions(prev =>
      prev.map(p =>
        p.id === draggingId ? { ...p, x: newX, y: newY } : p
      )
    );
  }, [draggingId, dragOffset, tables, scale]);

  // Handle drag move for walls
  const handleWallDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingWallRef.current || draggingWallId === null || !containerRef.current) return;

    e.preventDefault();
    const { clientX, clientY } = getEventPosition(e);
    const rect = containerRef.current.getBoundingClientRect();

    const wall = walls.find(w => w.id === draggingWallId);
    if (!wall) return;

    // Calculate wall dimensions
    const wallWidth = Math.abs(wall.endX - wall.startX);
    const wallHeight = Math.abs(wall.endY - wall.startY);

    // Calculate new center position
    const newCenterX = clientX - rect.left - dragOffset.x;
    const newCenterY = clientY - rect.top - dragOffset.y;

    // Calculate offset from current center
    const currentCenterX = (wall.startX + wall.endX) / 2;
    const currentCenterY = (wall.startY + wall.endY) / 2;
    const deltaX = newCenterX - currentCenterX;
    const deltaY = newCenterY - currentCenterY;

    // Calculate new positions
    let newStartX = wall.startX + deltaX;
    let newStartY = wall.startY + deltaY;
    let newEndX = wall.endX + deltaX;
    let newEndY = wall.endY + deltaY;

    // Clamp to canvas bounds
    const minX = Math.min(newStartX, newEndX);
    const maxX = Math.max(newStartX, newEndX);
    const minY = Math.min(newStartY, newEndY);
    const maxY = Math.max(newStartY, newEndY);

    if (minX < 0) {
      newStartX -= minX;
      newEndX -= minX;
    }
    if (maxX > CANVAS_WIDTH) {
      newStartX -= (maxX - CANVAS_WIDTH);
      newEndX -= (maxX - CANVAS_WIDTH);
    }
    if (minY < 0) {
      newStartY -= minY;
      newEndY -= minY;
    }
    if (maxY > CANVAS_HEIGHT) {
      newStartY -= (maxY - CANVAS_HEIGHT);
      newEndY -= (maxY - CANVAS_HEIGHT);
    }

    setWalls(prev =>
      prev.map(w =>
        w.id === draggingWallId
          ? { ...w, startX: newStartX, startY: newStartY, endX: newEndX, endY: newEndY }
          : w
      )
    );
  }, [draggingWallId, dragOffset, walls]);

  // Handle drag end for tables
  const handleDragEnd = useCallback(() => {
    if (isDraggingRef.current && draggingId !== null) {
      saveToHistory({ positions: tablePositions, walls });
      saveLayout(tablePositions, walls, scale);
    }
    setDraggingId(null);
    isDraggingRef.current = false;
  }, [draggingId, tablePositions, walls, saveToHistory, scale]);

  // Handle drag end for walls
  const handleWallDragEnd = useCallback(() => {
    if (isDraggingWallRef.current && draggingWallId !== null) {
      saveToHistory({ positions: tablePositions, walls });
      saveLayout(tablePositions, walls, scale);
    }
    setDraggingWallId(null);
    isDraggingWallRef.current = false;
  }, [draggingWallId, tablePositions, walls, saveToHistory, scale]);

  // Wall drawing handlers
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!isDrawingMode || isLocked) return;

    const { x, y } = getRelativePosition(e.clientX, e.clientY);

    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, x));
    const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT, y));

    if (!currentWall) {
      setCurrentWall({ startX: clampedX, startY: clampedY });
      setTempWallEnd({ x: clampedX, y: clampedY });
    } else {
      const newWall: WallLine = {
        id: `wall-${Date.now()}`,
        startX: currentWall.startX,
        startY: currentWall.startY,
        endX: clampedX,
        endY: clampedY,
      };
      const newWalls = [...walls, newWall];
      setWalls(newWalls);
      saveToHistory({ positions: tablePositions, walls: newWalls });
      saveLayout(tablePositions, newWalls, scale);
      setCurrentWall(null);
      setTempWallEnd(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDrawingMode && currentWall) {
      const { x, y } = getRelativePosition(e.clientX, e.clientY);
      const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, x));
      const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT, y));
      setTempWallEnd({ x: clampedX, y: clampedY });
    }
  };

  const cancelWallDrawing = () => {
    setCurrentWall(null);
    setTempWallEnd(null);
  };

  const deleteWall = (wallId: string) => {
    const newWalls = walls.filter(w => w.id !== wallId);
    setWalls(newWalls);
    saveToHistory({ positions: tablePositions, walls: newWalls });
    saveLayout(tablePositions, newWalls, scale);
  };

  const clearAllWalls = () => {
    setWalls([]);
    saveToHistory({ positions: tablePositions, walls: [] });
    saveLayout(tablePositions, [], scale);
  };

  // Add global event listeners
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (isDraggingRef.current) {
        handleDragMove(e);
      }
      if (isDraggingWallRef.current) {
        handleWallDragMove(e);
      }
    };

    const handleGlobalEnd = () => {
      if (isDraggingRef.current) {
        handleDragEnd();
      }
      if (isDraggingWallRef.current) {
        handleWallDragEnd();
      }
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);
    window.addEventListener('touchcancel', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
      window.removeEventListener('touchcancel', handleGlobalEnd);
    };
  }, [handleDragMove, handleDragEnd, handleWallDragMove, handleWallDragEnd]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Escape' && currentWall) {
        cancelWallDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, currentWall]);

  // Handle scale change
  const handleScaleChange = (value: number[]) => {
    const newScale = value[0];
    setScale(newScale);
    saveLayout(tablePositions, walls, newScale);
  };

  const resetPositions = () => {
    if (!tables) return;

    const positions = generateDefaultPositions(tables);
    setTablePositions(positions);
    setWalls([]);
    saveToHistory({ positions, walls: [] });
    saveLayout(positions, [], scale);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{tCommon("loading")}</div>;
  }

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-background p-2 md:p-4 flex flex-col overflow-hidden" : "relative"}`}>
      <div className="flex justify-between items-center mb-2 md:mb-4 px-2 md:px-4">
        <h2 className="text-lg md:text-2xl font-bold">{t("layout.title")}</h2>
        <div className="flex gap-1 md:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={!canUndo || isLocked}
            title={t("layout.undo") + " (Ctrl+Z)"}
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={redo}
            disabled={!canRedo || isLocked}
            title={t("layout.redo") + " (Ctrl+Shift+Z)"}
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <Button
            variant={isDrawingMode ? "default" : "outline"}
            size="icon"
            onClick={() => {
              setIsDrawingMode(!isDrawingMode);
              cancelWallDrawing();
            }}
            disabled={isLocked}
            title={t("layout.drawWalls")}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          {walls.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              onClick={clearAllWalls}
              disabled={isLocked}
              title={t("layout.clearWalls")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant={isLocked ? "default" : "outline"}
            size="icon"
            onClick={() => setIsLocked(!isLocked)}
            title={isLocked ? t("layout.unlock") : t("layout.lock")}
          >
            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={resetPositions}
            disabled={isLocked}
            title={t("layout.resetPositions")}
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? t("layout.exitFullscreen") : t("layout.fullscreen")}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Controls row: Legend and Scale - hidden in fullscreen */}
      {!isFullscreen && (
        <div className="flex gap-2 md:gap-4 px-2 md:px-4 mb-2 md:mb-4 flex-wrap items-center justify-between">
          <div className="flex gap-2 md:gap-4 flex-wrap">
            <div className="flex items-center gap-1 text-xs md:text-sm">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-500/20 border-2 border-blue-500"></div>
              <span>1-2</span>
            </div>
            <div className="flex items-center gap-1 text-xs md:text-sm">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-lg bg-green-500/20 border-2 border-green-500"></div>
              <span>3-4</span>
            </div>
            <div className="flex items-center gap-1 text-xs md:text-sm">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-lg bg-amber-500/20 border-2 border-amber-500"></div>
              <span>5-6</span>
            </div>
            <div className="flex items-center gap-1 text-xs md:text-sm">
              <div className="w-4 h-2.5 md:w-5 md:h-3 rounded-lg bg-purple-500/20 border-2 border-purple-500"></div>
              <span>7+</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-xs md:text-sm text-muted-foreground">{t("layout.scale")}:</span>
            <Slider
              value={[scale]}
              onValueChange={handleScaleChange}
              min={50}
              max={150}
              step={10}
              className="w-20 md:w-32"
              disabled={isLocked}
            />
            <span className="text-xs md:text-sm w-8 md:w-10">{scale}%</span>
          </div>
        </div>
      )}

      {/* Drawing mode indicator - hidden in fullscreen */}
      {isDrawingMode && !isFullscreen && (
        <div className="px-2 md:px-4 mb-2">
          <div className="bg-primary/10 border border-primary/30 rounded-lg px-2 md:px-3 py-1.5 md:py-2 flex items-center gap-2 text-xs md:text-sm">
            <Pencil className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
            <span className="truncate">{currentWall ? t("layout.clickToFinishWall") : t("layout.clickToStartWall")}</span>
            {currentWall && (
              <Button variant="ghost" size="sm" onClick={cancelWallDrawing} className="ml-auto h-6 px-2 shrink-0">
                <X className="h-3 w-3 mr-1" />
                {tCommon("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Canvas container */}
      <div className={`flex justify-center items-center overflow-auto ${isFullscreen ? "flex-1 p-2" : ""}`}>
        <div
          ref={containerRef}
          className={`relative bg-muted/20 border-2 border-dashed border-border rounded-lg select-none ${
            isLocked ? "cursor-not-allowed" : isDrawingMode ? "cursor-crosshair" : ""
          }`}
          style={{
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            touchAction: 'none',
          }}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
        >
          {/* Grid background */}
          <div
            className="absolute inset-0 bg-[linear-gradient(rgba(128,128,128,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(128,128,128,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"
          />

          {/* SVG for walls */}
          <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5 }}>
            {/* Existing walls */}
            {walls.map((wall) => {
              const isDraggingThis = draggingWallId === wall.id;
              return (
                <g key={wall.id}>
                  {/* Visible wall line */}
                  <line
                    x1={wall.startX}
                    y1={wall.startY}
                    x2={wall.endX}
                    y2={wall.endY}
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className={`text-foreground/70 ${isDraggingThis ? 'opacity-50' : ''}`}
                  />
                  {/* Drag/delete handle - wider invisible line for easier interaction */}
                  {!isLocked && !isDrawingMode && (
                    <line
                      x1={wall.startX}
                      y1={wall.startY}
                      x2={wall.endX}
                      y2={wall.endY}
                      stroke="transparent"
                      strokeWidth="20"
                      strokeLinecap="round"
                      className="cursor-move"
                      onMouseDown={(e) => handleWallDragStart(e, wall.id)}
                      onTouchStart={(e) => handleWallDragStart(e, wall.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        deleteWall(wall.id);
                      }}
                    />
                  )}
                </g>
              );
            })}

            {/* Current wall being drawn */}
            {currentWall && tempWallEnd && (
              <line
                x1={currentWall.startX}
                y1={currentWall.startY}
                x2={tempWallEnd.x}
                y2={tempWallEnd.y}
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8,4"
                className="text-primary"
              />
            )}
          </svg>

          {/* Tables */}
          {tables?.map((table) => {
            const position = tablePositions.find(p => p.id === table.id);
            if (!position) return null;

            const size = getTableSize(table.capacity);
            const isDragging = draggingId === table.id;

            return (
              <div
                key={table.id}
                className={`absolute flex flex-col items-center justify-center border-2 transition-all duration-75 ${getTableColor(table.capacity)} ${getTableShape(position, table.capacity)} ${
                  isDragging ? 'shadow-2xl scale-105 z-20 opacity-90' : 'shadow-md z-10'
                } ${isLocked ? 'cursor-not-allowed' : isDrawingMode ? 'cursor-crosshair' : 'cursor-move hover:shadow-lg active:scale-105'}`}
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: `${size.width}px`,
                  height: `${size.height}px`,
                }}
                onMouseDown={(e) => handleDragStart(e, table.id)}
                onTouchStart={(e) => handleDragStart(e, table.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleTableShape(table.id);
                }}
              >
                <div className="font-bold" style={{ fontSize: `${Math.max(10, 14 * scale / 100)}px` }}>
                  T{table.table_number}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: `${Math.max(8, 10 * scale / 100)}px` }}>
                  {table.capacity} pax
                </div>
                {/* Shape indicator */}
                {!isLocked && !isDrawingMode && (
                  <div className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow border opacity-0 hover:opacity-100 transition-opacity">
                    {position.shape === 'square' || (!position.shape && table.capacity > 2) ? (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Square className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {(!tables || tables.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {t("layout.noTables")}
            </div>
          )}

          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute inset-0 bg-background/10 flex items-center justify-center pointer-events-none z-30">
              <div className="bg-background/80 px-4 py-2 rounded-lg flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                {t("layout.lockedMode")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help message - hidden in fullscreen */}
      {!isFullscreen && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            {isLocked
              ? t("layout.unlockToEdit")
              : isDrawingMode
                ? t("layout.drawingHelp")
                : t("layout.dragHelpExtended")}
          </p>
        </div>
      )}
    </div>
  );
};

export default TableLayoutView;
