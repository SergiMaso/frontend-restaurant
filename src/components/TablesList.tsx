import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Ban, Check, Edit, Trash2, Link, Plus, LayoutGrid } from "lucide-react";
import { getTables, updateTable, deleteTable, createTable, generateCapacityTables, CapacityTablesError, type Table } from "@/services/api";
import { useTenantKey } from "@/hooks/useTenantKey";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import TableDialog from "./TableDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TablesListProps {
  onEdit?: (table: any) => void;
}

const TablesList = ({ onEdit }: TablesListProps = {}) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<any | null>(null);
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");

  const [capacityOpen, setCapacityOpen] = useState(false);
  const [insideSeats, setInsideSeats] = useState("");
  const [terraceSeats, setTerraceSeats] = useState("");

  // Read from the restaurant row, which every authenticated user receives via
  // /api/restaurants, rather than from /api/config, which is admin-only.
  //
  // This is not fixing a live bug: users_role_check allows only owner, admin and
  // superadmin, so there is no role today that would be refused by /api/config. It is
  // one source instead of two for a value the row already carries, and it keeps working
  // if the 'staff' role auth.py:587 refers to is ever actually added.
  const { selectedRestaurant } = useRestaurant();
  const tablesEnabled = selectedRestaurant?.tables_enabled ?? true;

  const tablesKey = useTenantKey(["tables"]);

  const { data: tables, isLoading } = useQuery({
    queryKey: tablesKey,
    queryFn: getTables,
  });

  const updateTableMutation = useMutation({
    mutationFn: ({ tableId, data }: { tableId: number; data: any }) =>
      updateTable(tableId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tablesKey });
      toast.success(t("tables.saveSuccess"));
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(t("tables.saveError") + ": " + error.message);
    },
  });

  const createTableMutation = useMutation({
    mutationFn: createTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tablesKey });
      toast.success(t("tables.saveSuccess"));
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(t("tables.saveError") + ": " + error.message);
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: deleteTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tablesKey });
      toast.success(t("tables.deleteSuccess"));
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(t("tables.deleteError") + ": " + error.message);
    },
  });

  const handleToggleStatus = (table: any) => {
    const newStatus = table.status === 'available' ? 'unavailable' : 'available';
    updateTableMutation.mutate({ 
      tableId: table.id, 
      data: { status: newStatus } 
    });
  };

  const handleEdit = (table: any) => {
    setSelectedTable(table);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTable(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleSave = (data: any) => {
    if (dialogMode === 'edit' && selectedTable) {
      updateTableMutation.mutate({ tableId: selectedTable.id, data });
    } else {
      createTableMutation.mutate(data);
    }
  };

  const handleDeleteClick = (table: any) => {
    setTableToDelete(table);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (tableToDelete) {
      deleteTableMutation.mutate(tableToDelete.id);
    }
  };

  const capacityMutation = useMutation({
    mutationFn: generateCapacityTables,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: tablesKey });
      const total = Object.values(result.created).reduce((a, b) => a + b, 0);
      toast.success(t("tables.capacityGenerated", { count: total }));
      setCapacityOpen(false);
    },
    onError: (error: CapacityTablesError) => {
      // A refusal because bookings still hold the current tables is not a failure the
      // user caused by typing something wrong, so it gets its own message telling them
      // what to do about it.
      if (error.code === "future_bookings") {
        toast.error(t("tables.capacityBlocked", { count: error.count }));
      } else {
        toast.error(error.message);
      }
    },
  });

  // What the restaurant currently holds, per area. In capacity mode the individual
  // tables are an implementation detail — a hundred cards each listing ninety-nine
  // pairings is unreadable and would put ten thousand badges on the page — so the seats
  // are summarised instead.
  const seatsByArea = (tables || []).reduce((acc: Record<string, number>, table: Table) => {
    acc[table.area] = (acc[table.area] || 0) + (table.capacity || 0);
    return acc;
  }, {});

  const openCapacityDialog = () => {
    setInsideSeats(String(seatsByArea.inside || 0));
    setTerraceSeats(String(seatsByArea.terrace || 0));
    setCapacityOpen(true);
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
    return tCommon(`tableStatus.${status}`) || status;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{tCommon("loading")}</div>;
  }

  return (
    <>
      {tablesEnabled ? (
        <div className="mb-4">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("tables.create")}
          </Button>
        </div>
      ) : (
        <div className="mb-4 p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-muted-foreground">{t("reservations.areaInside")}</p>
                <p className="text-2xl font-bold">{seatsByArea.inside || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("reservations.areaTerrace")}</p>
                <p className="text-2xl font-bold">{seatsByArea.terrace || 0}</p>
              </div>
            </div>
            <Button onClick={openCapacityDialog}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              {t("tables.setCapacity")}
            </Button>
          </div>
        </div>
      )}

      {tablesEnabled && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables?.map((table) => (
          <div
            key={table.id}
            className="p-4 rounded-lg border border-border bg-card hover:shadow-elegant transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{t("reservations.table")} {table.table_number}</h3>
                <Badge className={getStatusColor(table.status)}>
                  {getStatusLabel(table.status)}
                </Badge>
                <Badge variant="outline" className="ml-2">
                  {table.area === "terrace" ? t("reservations.areaTerrace") : t("reservations.areaInside")}
                </Badge>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {table.capacity}
              </Badge>
            </div>

            {table.pairing && table.pairing.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Link className="h-3 w-3" />
                  <span>Pairing:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {table.pairing.map((pairNum: number) => (
                    <Badge key={pairNum} variant="secondary" className="text-xs">
                      {t("reservations.table")} {pairNum}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-1.5 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(table)}
                className="flex-1 min-w-0 px-2"
                title={tCommon("edit")}
              >
                <Edit className="h-4 w-4 shrink-0" />
                <span className="ml-1 truncate hidden sm:inline">{tCommon("edit")}</span>
              </Button>

              <Button
                variant={table.status === 'available' ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleToggleStatus(table)}
                className="flex-1 min-w-0 px-2"
                title={table.status === 'available' ? tCommon("disable") : tCommon("enable")}
              >
                {table.status === 'available' ? (
                  <>
                    <Ban className="h-4 w-4 shrink-0" />
                    <span className="ml-1 truncate hidden sm:inline">{tCommon("disable")}</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 shrink-0" />
                    <span className="ml-1 truncate hidden sm:inline">{tCommon("enable")}</span>
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteClick(table)}
                className="px-2 shrink-0"
                title={tCommon("delete")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      )}

      {tablesEnabled && tables?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{tCommon("noResults")}</p>
        </div>
      )}

      <Dialog open={capacityOpen} onOpenChange={setCapacityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tables.setCapacity")}</DialogTitle>
            <DialogDescription>{t("tables.setCapacityHelp")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="inside-seats">{t("reservations.areaInside")}</Label>
              <Input
                id="inside-seats"
                type="number"
                min={0}
                value={insideSeats}
                onChange={(e) => setInsideSeats(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="terrace-seats">{t("reservations.areaTerrace")}</Label>
              <Input
                id="terrace-seats"
                type="number"
                min={0}
                value={terraceSeats}
                onChange={(e) => setTerraceSeats(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">{t("tables.setCapacityWarning")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapacityOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={capacityMutation.isPending}
              onClick={() =>
                capacityMutation.mutate({
                  inside: Number(insideSeats) || 0,
                  terrace: Number(terraceSeats) || 0,
                })
              }
            >
              {t("tables.setCapacityConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table={selectedTable}
        allTables={tables || []}
        onSave={handleSave}
        mode={dialogMode}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tables.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TablesList;
