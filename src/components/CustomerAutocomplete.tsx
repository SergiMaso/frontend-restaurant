import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { User, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  phone: string;
  name: string;
}

interface CustomerAutocompleteProps {
  customers?: Customer[];
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
  label: string;
  placeholder: string;
  type?: "name" | "phone";
  disabled?: boolean;
  required?: boolean;
}

const CustomerAutocomplete = ({
  customers = [],
  value,
  onChange,
  onSelectCustomer,
  label,
  placeholder,
  type = "name",
  disabled = false,
  required = false,
}: CustomerAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrar clients quan canvia el valor
  useEffect(() => {
    if (!value || value.length < 2) {
      setFilteredCustomers([]);
      setOpen(false);
      return;
    }

    const query = value.toLowerCase().trim();
    
    const filtered = customers
      .filter((customer) => {
        // Filtrar clients TEMP
        if (customer.name === 'TEMP') return false;
        
        // Buscar per nom o telèfon segons el tipus
        if (type === "name") {
          return customer.name.toLowerCase().includes(query);
        } else {
          // Per telèfon, eliminar espais i guions per comparar
          const cleanPhone = customer.phone.replace(/[\s-]/g, '');
          const cleanQuery = query.replace(/[\s-]/g, '');
          return cleanPhone.includes(cleanQuery) || customer.name.toLowerCase().includes(query);
        }
      })
      .slice(0, 5); // Mostrar màxim 5 resultats

    setFilteredCustomers(filtered);
    setOpen(filtered.length > 0);
  }, [value, customers, type]);

  // Tancar dropdown quan es fa clic fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    if (type === "name") {
      onChange(customer.name);
    } else {
      onChange(customer.phone);
    }
    
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
    
    setOpen(false);
  };

  return (
    <div className="space-y-2 relative" ref={inputRef}>
      <Label htmlFor={`autocomplete-${type}`}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={`autocomplete-${type}`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (value.length >= 2 && filteredCustomers.length > 0) {
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />
      
      {/* Dropdown de resultats */}
      {open && filteredCustomers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
          <Command>
            <CommandList>
              <CommandGroup>
                {filteredCustomers.map((customer) => (
                  <CommandItem
                    key={customer.phone}
                    value={customer.phone}
                    onSelect={() => handleSelectCustomer(customer)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium">{customer.name}</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};

export default CustomerAutocomplete;
