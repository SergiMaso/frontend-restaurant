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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ChevronDown, Plus, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const RestaurantSelector = () => {
  const { restaurants, selectedRestaurant, setSelectedRestaurant, refreshRestaurants, canSwitchRestaurant } = useRestaurant();
  const { isSuperadmin } = useAuth();
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [newRestaurantSlug, setNewRestaurantSlug] = useState('');
  const [creating, setCreating] = useState(false);

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newRestaurantName,
          slug: newRestaurantSlug,
        }),
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

      // Refresh list and select new restaurant
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

  // Don't show if user can't switch and is not superadmin
  if (!canSwitchRestaurant && !isSuperadmin) {
    return null;
  }

  // Show just the name if only one restaurant (but superadmin can still create)
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
    </>
  );
};

export default RestaurantSelector;
