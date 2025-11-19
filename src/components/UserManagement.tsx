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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
        title: t('userManagement.inviteSent'),
        description: data.email_sent
          ? t('userManagement.inviteSentDesc', { email })
          : t('userManagement.inviteCreatedManual'),
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
        title: t('common.error'),
        description: error.message || t('userManagement.inviteError'),
      });
    },
  });

  // Mutation per desactivar usuari
  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      toast({
        title: t('userManagement.userDeactivated'),
        description: t('userManagement.userDeactivatedDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('userManagement.deactivateError'),
      });
    },
  });

  const handleInvite = () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('userManagement.emailRequired'),
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
        title: t('userManagement.linkCopied'),
        description: t('userManagement.linkCopiedDesc'),
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, any> = {
      owner: 'default',
      admin: 'secondary',
      staff: 'outline',
    };

    return (
      <Badge variant={variants[role] || 'outline'}>
        {t(`roles.${role}`)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">{t('userManagement.loading')}</p>
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
              <CardTitle>{t('userManagement.title')}</CardTitle>
              <CardDescription>{t('userManagement.description')}</CardDescription>
            </div>

            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('userManagement.inviteUser')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('userManagement.inviteNewUser')}</DialogTitle>
                  <DialogDescription>
                    {t('userManagement.inviteDescription')}
                  </DialogDescription>
                </DialogHeader>
                
                {registerLink ? (
                  // Mostrar link de registre
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-2">{t('userManagement.registerLink')}:</p>
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
                          {t('userManagement.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          {t('userManagement.copyLink')}
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
                      {t('common.close')}
                    </Button>
                  </div>
                ) : (
                  // Formulari d'invitació
                  <>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">{t('userManagement.email')}</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={t('userManagement.emailPlaceholder')}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">{t('roles.role')}</Label>
                        <Select value={role} onValueChange={(value: 'admin' | 'staff') => setRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t('userManagement.adminDescription')}</SelectItem>
                            <SelectItem value="staff">{t('userManagement.staffDescription')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                        {inviteMutation.isPending ? t('userManagement.sending') : t('userManagement.sendInvite')}
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
                <TableHead>{t('userManagement.name')}</TableHead>
                <TableHead>{t('userManagement.email')}</TableHead>
                <TableHead>{t('roles.role')}</TableHead>
                <TableHead>{t('userManagement.status')}</TableHead>
                <TableHead>{t('userManagement.lastLogin')}</TableHead>
                <TableHead className="text-right">{t('userManagement.actions')}</TableHead>
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
                      {user.is_active ? t('userManagement.active') : t('userManagement.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_login
                      ? format(new Date(user.last_login), "d MMM yyyy, HH:mm", { locale: es })
                      : t('userManagement.never')
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== 'owner' && user.is_active && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <UserX className="h-4 w-4 mr-2" />
                            {t('userManagement.deactivate')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('userManagement.deactivateUser')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('userManagement.deactivateConfirm', { name: user.full_name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeactivate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('userManagement.deactivate')}
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
              {t('userManagement.noUsers')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
