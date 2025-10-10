import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Phone, Calendar, MessageCircle, X } from "lucide-react";
import { getCustomers, getConversations, type Conversation } from "@/services/api";
import { format } from "date-fns";
import { useState } from "react";

const CustomersList = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [conversationsDialogOpen, setConversationsDialogOpen] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations", selectedCustomer],
    queryFn: () => getConversations(selectedCustomer!),
    enabled: !!selectedCustomer && conversationsDialogOpen,
  });

  const handleViewConversations = (phone: string) => {
    setSelectedCustomer(phone);
    setConversationsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setConversationsDialogOpen(false);
    setSelectedCustomer(null);
  };

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case "ca":
        return "Català";
      case "es":
        return "Español";
      case "en":
        return "English";
      default:
        return lang;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregant clients...</div>;
  }

  return (
    <div className="space-y-4">
      {customers?.map((customer) => (
        <div
          key={customer.phone}
          className="p-4 rounded-lg border border-border bg-card hover:shadow-elegant transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1">
              <h3 className="font-bold text-lg">{customer.name}</h3>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {customer.visit_count} {customer.visit_count === 1 ? 'visita' : 'visites'}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary">
                {getLanguageLabel(customer.language)}
              </Badge>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Última visita: {format(new Date(customer.last_visit), "d MMM yyyy")}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewConversations(customer.phone)}
            className="w-full mt-3"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Veure converses
          </Button>
        </div>
      ))}

      {customers?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hi ha clients registrats</p>
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
                <div className="text-center py-8 text-muted-foreground">Carregant converses...</div>
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
                  No hi ha converses per mostrar
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersList;
