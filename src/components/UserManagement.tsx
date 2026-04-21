import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();
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
        title: t("users.invitationSent"),
        description: data.email_sent
          ? t("users.invitationSentTo", { email })
          : t("users.invitationCreatedManual"),
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
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: tCommon("error"),
        description: error.message || t("users.invitationError"),
      });
    },
  });

  // Mutation per desactivar usuari
  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      toast({
        title: t("users.userDeactivated"),
        description: t("users.userDeactivatedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: tCommon("error"),
        description: error.message || t("users.deactivateError"),
      });
    },
  });

  // Mutation per reactivar usuari
  const reactivateMutation = useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => {
      toast({
        title: t("users.userReactivated"),
        description: t("users.userReactivatedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: tCommon("error"),
        description: error.message || t("users.reactivateError"),
      });
    },
  });

  // Mutation per eliminar usuari
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast({
        title: t("users.userDeleted"),
        description: t("users.userDeletedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: tCommon("error"),
        description: error.message || t("users.deleteError"),
      });
    },
  });

  const handleInvite = () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: tCommon("error"),
        description: t("users.emailRequired"),
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
        title: t("users.linkCopied"),
        description: t("users.linkCopiedDesc"),
      });
    }
  };

  const getRoleBadge = (userRole: string) => {
    const variants: Record<string, any> = {
      owner: 'default',
      admin: 'secondary',
      staff: 'outline',
    };

    const labels: Record<string, string> = {
      owner: t("users.roleOwner"),
      admin: t("users.roleAdmin"),
      staff: t("users.roleStaff"),
    };

    return (
      <Badge variant={variants[userRole] || 'outline'}>
        {labels[userRole] || userRole}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">{tCommon("loading")}</p>
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
              <CardTitle>{t("users.title")}</CardTitle>
              <CardDescription>{t("users.subtitle")}</CardDescription>
            </div>

            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("users.invite")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("users.inviteTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("users.inviteDescription")}
                  </DialogDescription>
                </DialogHeader>
                
                {registerLink ? (
                  // Mostrar link de registre
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-2">{t("users.registerLink")}:</p>
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
                          {t("users.copied")}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          {t("users.copyLink")}
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
                      {tCommon("close")}
                    </Button>
                  </div>
                ) : (
                  // Formulari d'invitació
                  <>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("users.email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="user@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">{t("users.role")}</Label>
                        <Select value={role} onValueChange={(value: 'owner' | 'admin' | 'staff') => setRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isSuperadmin && (
                              <SelectItem value="owner">{t("users.roleOwnerDesc")}</SelectItem>
                            )}
                            <SelectItem value="admin">{t("users.roleAdminDesc")}</SelectItem>
                            <SelectItem value="staff">{t("users.roleStaffDesc")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        {tCommon("cancel")}
                      </Button>
                      <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                        {inviteMutation.isPending ? t("users.sending") : t("users.sendInvitation")}
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
                <TableHead>{t("users.name")}</TableHead>
                <TableHead>{t("users.email")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead>{t("users.lastLogin")}</TableHead>
                <TableHead className="text-right">{t("users.actions")}</TableHead>
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
                      {user.is_active ? t("users.active") : t("users.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_login
                      ? format(new Date(user.last_login), "d MMM yyyy, HH:mm", { locale: dateLocale })
                      : t("users.never")
                    }
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {/* Deactivate button - for active users */}
                    {user.role !== 'superadmin' && user.is_active && (isSuperadmin || (user.role !== 'owner')) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <UserX className="h-4 w-4 mr-1" />
                            {t("users.deactivate")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("users.deactivateTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("users.deactivateConfirm", { name: user.full_name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeactivate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("users.deactivate")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Reactivate button - for inactive users */}
                    {user.role !== 'superadmin' && !user.is_active && (isSuperadmin || (user.role !== 'owner')) && (
                      <Button variant="ghost" size="sm" onClick={() => handleReactivate(user.id)}>
                        <UserCheck className="h-4 w-4 mr-1" />
                        {t("users.reactivate")}
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
                            <AlertDialogTitle>{t("users.deleteTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("users.deleteConfirm", { name: user.full_name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {tCommon("delete")}
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
              {t("users.noUsers")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
