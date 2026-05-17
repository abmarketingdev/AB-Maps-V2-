import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface DashboardFiltersProps {
  onFiltersChange: (filters: {
    date_range?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    employee_id?: string;
  }) => void;
  loading: boolean;
}

export function DashboardFilters({ onFiltersChange, loading }: DashboardFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    date_range: 'today',
    start_date: '',
    end_date: '',
    status: '',
    employee_id: ''
  });

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDateRangeChange = (range: string) => {
    const newFilters = { 
      ...filters, 
      date_range: range,
      start_date: '',
      end_date: ''
    };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleCustomDateChange = (startDate: Date | undefined, endDate: Date | undefined) => {
    const newFilters = {
      ...filters,
      date_range: '',
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : '',
      end_date: endDate ? format(endDate, 'yyyy-MM-dd') : ''
    };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          <Filter className="mr-2 h-4 w-4" />
          Filtre
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date-range">Dato område</Label>
            <Select value={filters.date_range} onValueChange={handleDateRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Velg dato område" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">I dag</SelectItem>
                <SelectItem value="yesterday">I går</SelectItem>
                <SelectItem value="this_week">Denne uken</SelectItem>
                <SelectItem value="custom">Egendefinert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filters.date_range === 'custom' && (
            <div className="space-y-2">
              <Label>Egendefinert dato område</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="start-date" className="text-xs">Fra dato</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs">Til dato</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Alle statuser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statuser</SelectItem>
                <SelectItem value="ja">Ja</SelectItem>
                <SelectItem value="nei">Nei</SelectItem>
                <SelectItem value="ikke_hjemme">Ikke hjemme</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee">Ansatt ID (valgfritt)</Label>
            <Input
              id="employee"
              placeholder="Filtrer på spesifikk ansatt"
              value={filters.employee_id}
              onChange={(e) => handleFilterChange('employee_id', e.target.value)}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Kampanje ID og Manager ID hentes automatisk fra localStorage</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 