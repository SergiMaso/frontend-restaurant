import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Image as ImageIcon, Trash2, Eye, Calendar, Plus, X } from "lucide-react";
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
import { es } from "date-fns/locale";

// API functions
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const getMedia = async (type?: string, date?: string) => {
  const params = new URLSearchParams();
  if (type) params.append("type", type);
  if (date) params.append("date", date);
  
  const response = await fetch(`${API_BASE_URL}/api/media?${params}`);
  if (!response.ok) throw new Error("Error obtenint media");
  return response.json();
};

const uploadMedia = async (formData: FormData) => {
  const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error pujant arxiu");
  }
  
  return response.json();
};

const deleteMedia = async (mediaId: number) => {
  const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}`, {
    method: "DELETE",
  });
  
  if (!response.ok) throw new Error("Error eliminant media");
  return response.json();
};

const MediaManager = () => {
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [previewMedia, setPreviewMedia] = useState<any>(null);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string>("menu_dia");
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
      toast.success("✅ Arxiu pujat correctament!");
      setUploadDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`❌ Error: ${error.message}`);
    },
  });

  // Mutation per eliminar
  const deleteMutation = useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success("✅ Arxiu eliminat correctament!");
    },
    onError: (error: Error) => {
      toast.error(`❌ Error: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setMediaType("menu_dia");
    setTitle("");
    setDescription("");
    setDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validar mida (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("❌ L'arxiu és massa gran (màxim 10MB)");
        return;
      }
      
      // Validar tipus
      const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("❌ Tipus d'arxiu no vàlid. Usa PDF o imatges (JPG, PNG, GIF, WEBP)");
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
      toast.error("❌ Selecciona un arxiu primer");
      return;
    }
    
    if (!title.trim()) {
      toast.error("❌ El títol és obligatori");
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
    if (window.confirm(`Segur que vols eliminar "${mediaTitle}"?`)) {
      deleteMutation.mutate(mediaId);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      menu_dia: "📋 Menú del día",
      menu_carta: "📖 Carta",
      promocio: "🎉 Promoción",
      event: "🎊 Evento",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      menu_dia: "bg-blue-100 text-blue-700 border-blue-300",
      menu_carta: "bg-green-100 text-green-700 border-green-300",
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Media</h2>
          <p className="text-sm text-muted-foreground">
            Sube menús, cartas, promociones e imágenes
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Subir archivo
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        <Button
          variant={filterType === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("all")}
        >
          Todos
        </Button>
        <Button
          variant={filterType === "menu_dia" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("menu_dia")}
        >
          📋 Menú del día
        </Button>
        <Button
          variant={filterType === "menu_carta" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("menu_carta")}
        >
          📖 Carta
        </Button>
        <Button
          variant={filterType === "promocio" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("promocio")}
        >
          🎉 Promociones
        </Button>
        <Button
          variant={filterType === "event" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("event")}
        >
          🎊 Eventos
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
            <p className="text-lg font-medium mb-2">No hay archivos todavía</p>
            <p className="text-sm">Sube tu primer archivo para empezar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedia.map((media: any) => (
            <Card key={media.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge className={getTypeColor(media.type)} variant="outline">
                    {getTypeLabel(media.type)}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPreviewMedia(media)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(media.id, media.title)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{media.title}</CardTitle>
                {media.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {media.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {media.file_type === "pdf" ? (
                    <FileText className="h-4 w-4" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  <span className="uppercase">{media.file_type}</span>
                  {media.file_size && (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(media.file_size)}</span>
                    </>
                  )}
                </div>
                {media.date && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(media.date), "d 'de' MMMM 'de' yyyy", { locale: es })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog per pujar arxiu */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir archivo</DialogTitle>
            <DialogDescription>
              Sube un PDF o imagen para menús, cartas o promociones
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selector d'arxiu */}
            <div className="space-y-2">
              <Label htmlFor="file">Archivo *</Label>
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
              <Label htmlFor="type">Tipo *</Label>
              <Select value={mediaType} onValueChange={setMediaType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menu_dia">📋 Menú del día</SelectItem>
                  <SelectItem value="menu_carta">📖 Carta</SelectItem>
                  <SelectItem value="promocio">🎉 Promoción</SelectItem>
                  <SelectItem value="event">🎊 Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Títol */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Menú del 15 de octubre"
              />
            </div>

            {/* Descripció */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción opcional..."
                rows={3}
              />
            </div>

            {/* Data (només per menú del dia) */}
            {mediaType === "menu_dia" && (
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
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
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending ? "Subiendo..." : "Subir"}
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
            {previewMedia?.file_type === "pdf" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vista previa de PDF (abre en una nueva pestaña para ver completo)
                </p>
                <Button asChild>
                  <a href={previewMedia.file_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />
                    Abrir PDF
                  </a>
                </Button>
              </div>
            ) : (
              <img
                src={previewMedia?.file_url}
                alt={previewMedia?.title}
                className="w-full rounded-lg"
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewMedia(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaManager;
