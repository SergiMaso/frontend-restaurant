import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');

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
        title: tCommon('error'),
        description: t('restaurant.nameRequired'),
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
        throw new Error(error.error || t('restaurant.createError'));
      }

      const newRestaurant = await response.json();

      toast({
        title: t('restaurant.createSuccess'),
        description: `${newRestaurantName}`,
      });

      await refreshRestaurants();
      setSelectedRestaurant(newRestaurant);

      setCreateDialogOpen(false);
      setNewRestaurantName('');
      setNewRestaurantSlug('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.message || t('restaurant.createError'),
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
        throw new Error(error.error || t('restaurant.deleteError'));
      }

      toast({
        title: t('restaurant.deleteSuccess'),
        description: restaurantToDelete.name,
      });

      if (selectedRestaurant?.id === restaurantToDelete.id) {
        const remaining = restaurants.filter(r => r.id !== restaurantToDelete.id);
        if (remaining.length > 0) {
          localStorage.setItem('selectedRestaurantId', remaining[0].id.toString());
        }
      }

      setDeleteDialogOpen(false);
      setRestaurantToDelete(null);

      window.location.reload();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.message || t('restaurant.deleteError'),
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
              {selectedRestaurant?.name || t('restaurant.select')}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{t('tabs.tables').replace('Mesas', 'Restaurantes').replace('Tables', 'Restaurants').replace('Taules', 'Restaurants')}</DropdownMenuLabel>
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
                {t('restaurant.createNew')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setManageDialogOpen(true)}
                className="cursor-pointer"
              >
                <Settings className="h-4 w-4 mr-2" />
                {t('restaurant.manage')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Restaurant Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('restaurant.createNew')}</DialogTitle>
            <DialogDescription>
              {t('restaurant.create')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('restaurant.name')}</Label>
              <Input
                id="name"
                placeholder="El Buen Sabor"
                value={newRestaurantName}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t('restaurant.slug')}</Label>
              <Input
                id="slug"
                placeholder="el-buen-sabor"
                value={newRestaurantSlug}
                onChange={(e) => setNewRestaurantSlug(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreateRestaurant} disabled={creating}>
              {creating ? tCommon('saving') : t('restaurant.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Restaurants Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('restaurant.manage')}</DialogTitle>
            <DialogDescription>
              {t('users.description')}
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
              {tCommon('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('restaurant.confirmDelete')} "{restaurantToDelete?.name}"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRestaurant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RestaurantSelector;
