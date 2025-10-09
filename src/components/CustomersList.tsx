import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Users, Phone, Calendar } from "lucide-react";
import { getCustomers } from "@/services/api";
import { format } from "date-fns";

const CustomersList = () => {
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

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
        </div>
      ))}

      {customers?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hi ha clients registrats</p>
        </div>
      )}
    </div>
  );
};

export default CustomersList;
