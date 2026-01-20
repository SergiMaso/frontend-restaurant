import { useState } from 'react';
import { useRestaurant, Restaurant } from '@/contexts/RestaurantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ChevronDown, Plus, Check, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const RestaurantSelector = () => {
  const { restaurants, selectedRestaurant, setSelectedRestaurant, refreshRestaurants, canSwitchRestaurant } = useRestaurant();
  const { isSuperadmin } = useAuth();
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);
  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [newRestaurantSlug, setNewRestaurantSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setNewRestaurantName(name);
    setNewRestaurantSlug(generateSlug(name));
  };

  const handleCreateRestaurant = async () => {
    if (!newRestaurantName.trim() || !newRestaurantSlug.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Nombre y slug son obligatorios',
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newRestaurantName, slug: newRestaurantSlug }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error creating restaurant');
      }

      const newRestaurant = await response.json();
      
      toast({
        title: 'Restaurante creado',
        description: `${newRestaurantName} ha sido creado correctamente`,
      });

      await refreshRestaurants();
      setSelectedRestaurant(newRestaurant);
      
      setCreateDialogOpen(false);
      setNewRestaurantName('');
      setNewRestaurantSlug('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo crear el restaurante',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRestaurant = async () => {
    if (!restaurantToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/restaurants/${restaurantToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error deleting restaurant');
      }

      toast({
        title: 'Restaurante eliminado',
        description: `${restaurantToDelete.name} ha sido eliminado`,
      });

      // If we deleted the selected restaurant, select another one
      if (selectedRestaurant?.id === restaurantToDelete.id) {
        const remaining = restaurants.filter(r => r.id !== restaurantToDelete.id);
        if (remaining.length > 0) {
          localStorage.setItem('selectedRestaurantId', remaining[0].id.toString());
        }
      }

      setDeleteDialogOpen(false);
      setRestaurantToDelete(null);
      
      // Reload to refresh everything
      window.location.reload();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar el restaurante',
      });
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (restaurant: Restaurant) => {
    setRestaurantToDelete(restaurant);
    setDeleteDialogOpen(true);
  };

  if (!canSwitchRestaurant && !isSuperadmin) {
    return null;
  }

  if (restaurants.length <= 1 && !isSuperadmin) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="max-w-[150px] truncate">
              {selectedRestaurant?.name || 'Seleccionar'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Restaurantes</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {restaurants.map((restaurant) => (
            <DropdownMenuItem
              key={restaurant.id}
              onClick={() => setSelectedRestaurant(restaurant)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span>{restaurant.name}</span>
                {selectedRestaurant?.id === restaurant.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
          
          {isSuperadmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCreateDialogOpen(true)}
                className="cursor-pointer text-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Nuevo Restaurante
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setManageDialogOpen(true)}
                className="cursor-pointer"
              >
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Restaurantes
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Restaurant Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Restaurante</DialogTitle>
            <DialogDescription>
              Añade un nuevo restaurante al sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Restaurante</Label>
              <Input
                id="name"
                placeholder="El Buen Sabor"
                value={newRestaurantName}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slug">Identificador (slug)</Label>
              <Input
                id="slug"
                placeholder="el-buen-sabor"
                value={newRestaurantSlug}
                onChange={(e) => setNewRestaurantSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se usa para identificar el restaurante internamente
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateRestaurant} disabled={creating}>
              {creating ? 'Creando...' : 'Crear Restaurante'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Restaurants Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionar Restaurantes</DialogTitle>
            <DialogDescription>
              Administra los restaurantes del sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-4 max-h-[300px] overflow-y-auto">
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{restaurant.name}</p>
                  <p className="text-xs text-muted-foreground">{restaurant.slug}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => openDeleteDialog(restaurant)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar restaurante</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que quieres eliminar "{restaurantToDelete?.name}"? 
              Esta acción desactivará el restaurante y todos sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRestaurant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RestaurantSelector;
