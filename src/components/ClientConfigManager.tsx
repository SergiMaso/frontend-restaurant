import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClientConfigs, updateClientConfig } from "@/services/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const ClientConfigManager = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["client-configs"],
    queryFn: getClientConfigs,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateClientConfig(key, value),
    onSuccess: () => {
      toast({
        title: t('clientConfig.updateSuccess'),
        description: t('clientConfig.updateSuccessDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ["client-configs"] });
      setEditingKey(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = (key: string) => {
    updateMutation.mutate({ key, value: editValue });
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue("");
  };

  // Agrupar configuracions per categoria
  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, typeof configs>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('clientConfig.title')}</CardTitle>
              <CardDescription>
                {t('clientConfig.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {Object.entries(groupedConfigs).map(
              ([category, categoryConfigs]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm font-medium">
                      {t(`clientConfig.categories.${category}`)}
                    </Badge>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">{t('clientConfig.key')}</TableHead>
                        <TableHead className="w-[20%]">{t('clientConfig.value')}</TableHead>
                        <TableHead className="w-[35%]">{t('clientConfig.description')}</TableHead>
                        <TableHead className="text-right w-[15%]">
                          {t('clientConfig.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryConfigs.map((config) => (
                        <TableRow
                          key={config.key}
                          className="hover:bg-muted/30"
                        >
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {config.key}
                          </TableCell>
                          <TableCell>
                            {editingKey === config.key ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="max-w-[150px]"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium">{config.value}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {config.description}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingKey === config.key ? (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(config.key)}
                                  disabled={updateMutation.isPending}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  {t('clientConfig.save')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancel}
                                  disabled={updateMutation.isPending}
                                >
                                  {t('common.cancel')}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleEdit(config.key, config.value)
                                }
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                {t('common.edit')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="text-primary mt-0.5">ℹ️</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">{t('clientConfig.infoTitle')}:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  {t('clientConfig.info1')}
                </li>
                <li>
                  {t('clientConfig.info2')}
                </li>
                <li>{t('clientConfig.info3')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientConfigManager;
