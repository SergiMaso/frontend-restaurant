import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Image as ImageIcon, Trash2, Eye, Calendar, Plus, X, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { getMedia, uploadMedia, deleteMedia } from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";

const MediaManager = () => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [previewMedia, setPreviewMedia] = useState<any>(null);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string>("carta");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Query per obtenir media
  const { data: allMedia, isLoading } = useQuery({
    queryKey: ["media"],
    queryFn: () => getMedia(),
  });

  // Mutation per pujar arxiu
  const uploadMutation = useMutation({
    mutationFn: uploadMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success(t("media.uploadSuccess"));
      setUploadDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`${tCommon("error")}: ${error.message}`);
    },
  });

  // Mutation per eliminar
  const deleteMutation = useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success(t("media.deleteSuccess"));
    },
    onError: (error: Error) => {
      toast.error(`${tCommon("error")}: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setMediaType("carta");
    setTitle("");
    setDescription("");
    setDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validar mida (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("media.fileTooLarge"));
        return;
      }

      // Validar tipus
      const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error(t("media.invalidFileType"));
        return;
      }
      
      setSelectedFile(file);
      
      // Auto-omplir títol amb nom de l'arxiu
      if (!title) {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        setTitle(fileName);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast.error(t("media.selectFileFirst"));
      return;
    }

    if (!title.trim()) {
      toast.error(t("media.titleRequired"));
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", mediaType);
    formData.append("title", title);
    if (description) formData.append("description", description);
    if (mediaType === "menu_dia" && date) formData.append("date", date);

    uploadMutation.mutate(formData);
  };

  const handleDelete = (mediaId: number, mediaTitle: string) => {
    if (window.confirm(t("media.confirmDelete", { title: mediaTitle }))) {
      deleteMutation.mutate(mediaId);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      menu_dia: `📋 ${t("media.typeMenuDia")}`,
      carta: `📖 ${t("media.typeCarta")}`,
      promocio: `🎉 ${t("media.typePromocio")}`,
      event: `🎊 ${t("media.typeEvent")}`,
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      menu_dia: "bg-blue-100 text-blue-700 border-blue-300",
      carta: "bg-green-100 text-green-700 border-green-300",
      promocio: "bg-yellow-100 text-yellow-700 border-yellow-300",
      event: "bg-purple-100 text-purple-700 border-purple-300",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  const filteredMedia = allMedia?.filter((media: any) => {
    if (filterType === "all") return true;
    return media.type === filterType;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Check if media is PDF by file_type or file_url
  const isPdf = (media: any) => {
    if (media.file_type?.toLowerCase().includes("pdf")) return true;
    if (media.file_url?.toLowerCase().endsWith(".pdf")) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("media.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("media.subtitle")}
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("media.upload")}
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterType === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("all")}
        >
          {t("media.filterAll")}
        </Button>
        <Button
          variant={filterType === "menu_dia" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("menu_dia")}
        >
          📋 {t("media.typeMenuDia")}
        </Button>
        <Button
          variant={filterType === "carta" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("carta")}
        >
          📖 {t("media.typeCarta")}
        </Button>
        <Button
          variant={filterType === "promocio" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("promocio")}
        >
          🎉 {t("media.typePromocio")}
        </Button>
        <Button
          variant={filterType === "event" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("event")}
        >
          🎊 {t("media.typeEvent")}
        </Button>
      </div>

      {/* Llista de media */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !filteredMedia || filteredMedia.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">{t("media.noFiles")}</p>
            <p className="text-sm">{t("media.uploadFirst")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedia.map((media: any) => (
            <Card key={media.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Image/PDF Preview */}
              <div
                className="relative h-44 bg-gradient-to-br from-muted to-muted/50 cursor-pointer overflow-hidden"
                onClick={() => setPreviewMedia(media)}
              >
                {isPdf(media) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20">
                    <div className="bg-red-500 rounded-lg p-4 shadow-lg">
                      <FileText className="h-12 w-12 text-white" />
                    </div>
                    <span className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">PDF</span>
                    <span className="text-xs text-muted-foreground mt-1">{t("media.preview")}</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
                    <div className="bg-blue-500 rounded-lg p-4 shadow-lg">
                      <ImageIcon className="h-12 w-12 text-white" />
                    </div>
                    <span className="mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400">{media.file_type?.toUpperCase() || "IMG"}</span>
                    <span className="text-xs text-muted-foreground mt-1">{t("media.preview")}</span>
                  </div>
                )}
                {/* Overlay with actions */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewMedia(media);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-destructive hover:text-destructive shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(media.id, media.title);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {/* Type badge overlay */}
                <div className="absolute top-2 left-2">
                  <Badge className={`${getTypeColor(media.type)} shadow-sm`} variant="outline">
                    {getTypeLabel(media.type)}
                  </Badge>
                </div>
              </div>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base truncate">{media.title}</CardTitle>
                {media.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {media.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="uppercase font-medium">{media.file_type}</span>
                  {media.file_size && (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(media.file_size)}</span>
                    </>
                  )}
                  {media.date && (
                    <>
                      <span>•</span>
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(new Date(media.date), "d MMM yyyy", { locale: dateLocale })}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog per pujar arxiu */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("media.uploadTitle")}</DialogTitle>
            <DialogDescription>
              {t("media.uploadDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selector d'arxiu */}
            <div className="space-y-2">
              <Label htmlFor="file">{t("media.file")} *</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handleFileChange}
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            {/* Tipus */}
            <div className="space-y-2">
              <Label htmlFor="type">{t("media.type")} *</Label>
              <Select value={mediaType} onValueChange={setMediaType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menu_dia">📋 {t("media.typeMenuDia")}</SelectItem>
                  <SelectItem value="carta">📖 {t("media.typeCarta")}</SelectItem>
                  <SelectItem value="promocio">🎉 {t("media.typePromocio")}</SelectItem>
                  <SelectItem value="event">🎊 {t("media.typeEvent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Títol */}
            <div className="space-y-2">
              <Label htmlFor="title">{t("media.titleLabel")} *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("media.titlePlaceholder")}
              />
            </div>

            {/* Descripció */}
            <div className="space-y-2">
              <Label htmlFor="description">{t("media.description")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("media.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            {/* Data (només per menú del dia) */}
            {mediaType === "menu_dia" && (
              <div className="space-y-2">
                <Label htmlFor="date">{t("media.date")}</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending ? t("media.uploading") : t("media.upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de preview */}
      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewMedia?.title}</DialogTitle>
            {previewMedia?.description && (
              <DialogDescription>{previewMedia.description}</DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4">
            {previewMedia && isPdf(previewMedia) ? (
              <div className="space-y-4 text-center">
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 rounded-lg p-8">
                  <div className="bg-red-500 rounded-lg p-6 shadow-lg inline-block mb-4">
                    <FileText className="h-16 w-16 text-white" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("media.pdfPreview")}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button asChild>
                      <a href={previewMedia.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t("media.openPdf")}
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={previewMedia.file_url} download>
                        <Download className="h-4 w-4 mr-2" />
                        {t("media.download")}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <img
                  src={previewMedia?.file_url}
                  alt={previewMedia?.title}
                  className="w-full rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex gap-2 justify-center">
                  <Button asChild>
                    <a href={previewMedia?.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t("media.openFile")}
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={previewMedia?.file_url} download>
                      <Download className="h-4 w-4 mr-2" />
                      {t("media.download")}
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewMedia(null)}>
              {tCommon("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaManager;
