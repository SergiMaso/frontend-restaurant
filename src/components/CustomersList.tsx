import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Phone, Calendar, MessageCircle, X, Search, Send, Edit, UtensilsCrossed } from "lucide-react";
import { getCustomers, getConversations, type Conversation } from "@/services/api";
import { format } from "date-fns";
import { useState, useMemo, useEffect, useRef } from "react";
import BroadcastManager from "@/components/BroadcastManager";
import EditCustomerDialog from "@/components/EditCustomerDialog";
import { useTranslation } from "react-i18next";

const CustomersList = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [conversationsDialogOpen, setConversationsDialogOpen] = useState(false);
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [editCustomerDialogOpen, setEditCustomerDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations", selectedCustomer],
    queryFn: () => getConversations(selectedCustomer!),
    enabled: !!selectedCustomer && conversationsDialogOpen,
  });

  // Scroll automàtic cap a baix quan es carreguen les converses
  useEffect(() => {
    if (conversations && conversations.length > 0 && conversationsDialogOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversations, conversationsDialogOpen]);

  // Filtrar clients per telèfon o nom
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchQuery.trim()) return customers;

    const query = searchQuery.toLowerCase().trim();
    return customers.filter(
      (customer) =>
        customer.phone.includes(query) ||
        customer.name.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  // Comptar clients amb reserva avui
  const customersWithReservationToday = useMemo(() => {
    return filteredCustomers?.filter(c => c.has_reservation_today).length || 0;
  }, [filteredCustomers]);

  const handleViewConversations = (phone: string) => {
    setSelectedCustomer(phone);
    setConversationsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setConversationsDialogOpen(false);
    setSelectedCustomer(null);
    setMessageText("");
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedCustomer) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          phone: selectedCustomer,
          message: messageText,
        }),
      });

      if (!response.ok) {
        throw new Error('Error enviando mensaje');
      }

      // Netejar l'input
      setMessageText("");

      // Refrescar converses
      queryClient.invalidateQueries({ queryKey: ["conversations", selectedCustomer] });

      // Fer scroll cap a baix després d'enviar
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // Toast success
      const toast = (await import("sonner")).toast;
      toast.success(t('customers.messageSent'));
    } catch (error) {
      const toast = (await import("sonner")).toast;
      toast.error(t('customers.messageError'));
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEditCustomer = (customer: any) => {
    setCustomerToEdit(customer);
    setEditCustomerDialogOpen(true);
  };

  const getLanguageLabel = (lang: string) => {
    const languages: { [key: string]: string } = {
      'ca': '🌍 Català',
      'es': '🇪🇸 Español',
      'en': '🇬🇧 English',
      'fr': '🇫🇷 Français',
      'de': '🇩🇪 Deutsch',
      'it': '🇮🇹 Italiano',
      'pt': '🇵🇹 Português',
      'ru': '🇷🇺 Русский',
      'zh': '🇨🇳 中文',
      'ja': '🇯🇵 日本語',
      'ko': '🇰🇷 한국어',
      'ar': '🇸🇦 العربية',
    };
    
    return languages[lang] || `🌍 ${lang.toUpperCase()}`;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{t('customers.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header amb botó de Broadcast */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('customers.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Botó Missatge Difús */}
        <Button
          onClick={() => setBroadcastDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Send className="h-4 w-4" />
          {t('customers.broadcast')}
        </Button>
      </div>

      {/* Badge informatiu: clients amb reserva avui */}
      {customersWithReservationToday > 0 && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-green-600 dark:text-green-400" />
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            {customersWithReservationToday} {customersWithReservationToday === 1 ? t('customers.hasReservationCount_one') : t('customers.hasReservationCount_other')}
          </p>
        </div>
      )}

      {/* Llista de clients */}
      {filteredCustomers?.map((customer) => (
        <div
          key={customer.phone}
          className={`p-4 rounded-lg border bg-card hover:shadow-elegant transition-all duration-300 ${
            customer.has_reservation_today 
              ? 'border-green-500 dark:border-green-700 shadow-md' 
              : 'border-border'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg">{customer.name}</h3>
                {customer.has_reservation_today && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-white">
                    <UtensilsCrossed className="h-3 w-3 mr-1" />
                    {t('customers.hasReservation')}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {customer.visit_count} {customer.visit_count === 1 ? t('customers.visits') : t('customers.visits_plural')}
              </Badge>
              {customer.no_show_count > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  ❌ {customer.no_show_count} {customer.no_show_count > 1 ? t('customers.noShows') : t('customers.noShow')}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm mb-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary">
                {getLanguageLabel(customer.language)}
              </Badge>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {t('customers.lastVisit')}: {format(new Date(customer.last_visit), "d MMM yyyy")}
              </span>
            </div>
          </div>

          {/* Botons d'acció */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewConversations(customer.phone)}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {t('customers.viewConversations')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditCustomer(customer)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('customers.editCustomer')}
            </Button>
          </div>
        </div>
      ))}

      {filteredCustomers?.length === 0 && searchQuery && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('customers.noResults')} "{searchQuery}"</p>
        </div>
      )}

      {filteredCustomers?.length === 0 && !searchQuery && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('customers.noCustomers')}</p>
        </div>
      )}

      {/* Diàleg de converses estil xat */}
      {conversationsDialogOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={handleCloseDialog}
        >
          <div 
            className="bg-card border border-border rounded-lg w-full max-w-2xl h-[600px] flex flex-col shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {customers?.find(c => c.phone === selectedCustomer)?.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedCustomer}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseDialog}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Missatges */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationsLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('customers.loadingConversations')}</div>
              ) : conversations && conversations.length > 0 ? (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex ${conv.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        conv.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{conv.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {format(new Date(conv.created_at), "HH:mm - d MMM")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t('customers.noConversations')}
                </div>
              )}
              {/* Referència per fer scroll automàtic */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input per enviar missatge */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={t('customers.writeMessage')}
                  disabled={sendingMessage}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageText.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diàleg de Broadcast */}
      <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              {t('customers.broadcast')}
            </DialogTitle>
          </DialogHeader>
          <BroadcastManager />
        </DialogContent>
      </Dialog>

      {/* Diàleg d'Editar Client */}
      <EditCustomerDialog
        open={editCustomerDialogOpen}
        onOpenChange={setEditCustomerDialogOpen}
        customer={customerToEdit}
      />
    </div>
  );
};

export default CustomersList;
