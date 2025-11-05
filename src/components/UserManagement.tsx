import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, sendInvitation, deactivateUser } from "@/services/auth";
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
import { UserPlus, UserX, Copy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'staff';
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

const UserManagement = () => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'admin' | 'staff'>('admin');
  const [registerLink, setRegisterLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const { toast } = useToast();
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
        title: "Invitació enviada",
        description: data.email_sent 
          ? `Invitació enviada a ${email}` 
          : "Invitació creada. Copia el link i envia'l manualment.",
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
        description: error.message || "No s'ha pogut enviar la invitació",
      });
    },
  });

  // Mutation per desactivar usuari
  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      toast({
        title: "Usuari desactivat",
        description: "L'usuari ha estat desactivat correctament",
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No s'ha pogut desactivar l'usuari",
      });
    },
  });

  const handleInvite = () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "L'email és obligatori",
      });
      return;
    }
    
    inviteMutation.mutate({ email, role });
  };

  const handleDeactivate = (userId: number) => {
    deactivateMutation.mutate(userId);
  };

  const copyToClipboard = () => {
    if (registerLink) {
      navigator.clipboard.writeText(registerLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      
      toast({
        title: "Link copiat",
        description: "El link de registre s'ha copiat al portapapers",
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
      owner: 'Propietari',
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
          <p className="text-center text-muted-foreground">Carregant usuaris...</p>
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
              <CardTitle>Gestió d'Usuaris</CardTitle>
              <CardDescription>Administra els usuaris del sistema</CardDescription>
            </div>
            
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invitar Usuari
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invitar Nou Usuari</DialogTitle>
                  <DialogDescription>
                    Envia una invitació per email perquè es pugui registrar al sistema
                  </DialogDescription>
                </DialogHeader>
                
                {registerLink ? (
                  // Mostrar link de registre
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-2">Link de registre:</p>
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
                          Copiat!
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
                      Tancar
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
                        <Select value={role} onValueChange={(value: 'admin' | 'staff') => setRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador (pot gestionar reserves i clients)</SelectItem>
                            <SelectItem value="staff">Personal (només pot veure)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancel·lar
                      </Button>
                      <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                        {inviteMutation.isPending ? 'Enviant...' : 'Enviar Invitació'}
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
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estat</TableHead>
                <TableHead>Últim Login</TableHead>
                <TableHead className="text-right">Accions</TableHead>
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
                      {user.is_active ? 'Actiu' : 'Inactiu'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_login 
                      ? format(new Date(user.last_login), "d MMM yyyy, HH:mm", { locale: es })
                      : 'Mai'
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== 'owner' && user.is_active && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <UserX className="h-4 w-4 mr-2" />
                            Desactivar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desactivar usuari</AlertDialogTitle>
                            <AlertDialogDescription>
                              Estàs segur que vols desactivar a {user.full_name}? 
                              No podrà accedir al sistema fins que el tornis a activar.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No hi ha usuaris registrats
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
