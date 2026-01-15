import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, sendInvitation, deactivateUser, reactivateUser, deleteUser } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, UserX, UserCheck, Trash2, Copy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'superadmin' | 'owner' | 'admin' | 'staff';
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

const UserManagement = () => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'owner' | 'admin' | 'staff'>('admin');
  const [registerLink, setRegisterLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const { toast } = useToast();
  const { isSuperadmin } = useAuth();
  const queryClient = useQueryClient();

  // Query per obtenir usuaris
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });

  // Mutation per enviar invitació
  const inviteMutation = useMutation({
    mutationFn: sendInvitation,
    onSuccess: (data) => {
      toast({
        title: "Invitación enviada",
        description: data.email_sent 
          ? `Invitación enviada a ${email}` 
          : "Invitación creada. Copia el link y envialo manualmente.",
      });
      
      // Si hi ha link manual, mostrar-lo
      if (data.register_link) {
        setRegisterLink(data.register_link);
      } else {
        setInviteDialogOpen(false);
        setEmail("");
        setRole('admin');
      }
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se ha podido enviar la invitación",
      });
    },
  });

  // Mutation per desactivar usuari
  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      toast({
        title: "Usuario desactivado",
        description: "El usuario ha sido desactivado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se ha podido desactivar el usuario",
      });
    },
  });

  // Mutation per reactivar usuari
  const reactivateMutation = useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => {
      toast({
        title: "Usuario reactivado",
        description: "El usuario ha sido reactivado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se ha podido reactivar el usuario",
      });
    },
  });

  // Mutation per eliminar usuari
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado permanentemente",
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se ha podido eliminar el usuario",
      });
    },
  });

  const handleInvite = () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El email es obligatorio",
      });
      return;
    }
    
    inviteMutation.mutate({ email, role });
  };

  const handleDeactivate = (userId: number) => {
    deactivateMutation.mutate(userId);
  };

  const handleReactivate = (userId: number) => {
    reactivateMutation.mutate(userId);
  };

  const handleDelete = (userId: number) => {
    deleteMutation.mutate(userId);
  };

  const copyToClipboard = () => {
    if (registerLink) {
      navigator.clipboard.writeText(registerLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      
      toast({
        title: "Link copiado",
        description: "El link ha sido copiado al portapapeles",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, any> = {
      owner: 'default',
      admin: 'secondary',
      staff: 'outline',
    };
    
    const labels: Record<string, string> = {
      owner: 'Propietario',
      admin: 'Administrador',
      staff: 'Personal',
    };
    
    return (
      <Badge variant={variants[role] || 'outline'}>
        {labels[role] || role}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Cargando usuarios...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión de Usuarios</CardTitle>
              <CardDescription>Administra los usuarios del sistema</CardDescription>
            </div>
            
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invitar Usuario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
                  <DialogDescription>
                    Envia una invitación por email para que el usuario se registre en la plataforma.
                  </DialogDescription>
                </DialogHeader>
                
                {registerLink ? (
                  // Mostrar link de registre
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-2">Link de registro:</p>
                      <p className="text-xs break-all">{registerLink}</p>
                    </div>
                    
                    <Button 
                      onClick={copyToClipboard} 
                      className="w-full"
                      variant={copiedLink ? "outline" : "default"}
                    >
                      {copiedLink ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar Link
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        setInviteDialogOpen(false);
                        setRegisterLink(null);
                        setEmail("");
                        setRole('admin');
                      }} 
                      variant="outline"
                      className="w-full"
                    >
                      Cerrar
                    </Button>
                  </div>
                ) : (
                  // Formulari d'invitació
                  <>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="usuari@exemple.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="role">Rol</Label>
                        <Select value={role} onValueChange={(value: 'owner' | 'admin' | 'staff') => setRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isSuperadmin && (
                              <SelectItem value="owner">Propietario (control total del restaurante)</SelectItem>
                            )}
                            <SelectItem value="admin">Administrador (puede gestionar reservas y clientes)</SelectItem>
                            <SelectItem value="staff">Personal (solo visualización)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                        {inviteMutation.isPending ? 'Enviando...' : 'Enviar Invitación'}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'destructive'}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_login 
                      ? format(new Date(user.last_login), "d MMM yyyy, HH:mm", { locale: es })
                      : 'Nunca'
                    }
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {/* Deactivate button - for active users */}
                    {user.role !== 'superadmin' && user.is_active && (isSuperadmin || (user.role !== 'owner')) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <UserX className="h-4 w-4 mr-1" />
                            Desactivar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desactivar usuario</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro que quieres desactivar a {user.full_name}? 
                              No podrá acceder al sistema hasta que lo re-activen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeactivate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Desactivar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    
                    {/* Reactivate button - for inactive users */}
                    {user.role !== 'superadmin' && !user.is_active && (isSuperadmin || (user.role !== 'owner')) && (
                      <Button variant="ghost" size="sm" onClick={() => handleReactivate(user.id)}>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Reactivar
                      </Button>
                    )}
                    
                    {/* Delete button - superadmin can delete anyone, owner can delete admin/staff */}
                    {user.role !== 'superadmin' && (isSuperadmin || (user.role !== 'owner')) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar usuario permanentemente</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro que quieres eliminar a {user.full_name}? 
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No hay usuarios registrados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
