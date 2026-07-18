import { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { listFilterSummary } from '@/lib/todoListFilters';
import {
  DEFAULT_LIST_FILTERS,
  type TodosListFilters,
  type TodosScheduleFilter,
  type TodosScopeFilter,
  type TodosStatusFilter,
} from '@/lib/todosScreenIntent';

const STATUS_OPTIONS: { value: TodosStatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

const SCHEDULE_OPTIONS: { value: TodosScheduleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'timed', label: 'Timed' },
  { value: 'later', label: 'Later' },
  { value: 'allDay', label: 'All day' },
];

const SCOPE_OPTIONS: { value: TodosScopeFilter; label: string }[] = [
  { value: 'thisDay', label: 'This day' },
  { value: 'allOpen', label: 'All open' },
  { value: 'recent', label: 'Recent 14d' },
];

function FilterOptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = options.length,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  columns?: number;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-1 rounded-xl border border-border/40 bg-card/50 p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={columns === 2 ? { width: '48%', flexGrow: 1 } : { flex: 1 }}
              className={`items-center rounded-lg px-2 py-2 ${active ? 'bg-primary/15' : ''}`}
            >
              <Text
                className={`text-xs font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TodoFilterChips({
  filters,
  onChange,
}: {
  filters: TodosListFilters;
  onChange: (next: TodosListFilters) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDefault = useMemo(
    () =>
      filters.status === DEFAULT_LIST_FILTERS.status &&
      filters.schedule === DEFAULT_LIST_FILTERS.schedule &&
      filters.scope === DEFAULT_LIST_FILTERS.scope,
    [filters]
  );
  const summary = useMemo(() => listFilterSummary(filters), [filters]);

  return (
    <View className="mb-2 px-4">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide list filters' : 'Show list filters'}
        className="flex-row items-center justify-between rounded-xl border border-border/40 bg-card/50 px-3 py-2.5"
      >
        <View className="min-w-0 flex-1 pr-2">
          <Text className="text-xs font-semibold text-foreground">Filters</Text>
          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
            {summary}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </Pressable>

      {expanded ? (
        <View className="mt-2 gap-3 rounded-xl border border-border/40 bg-card/30 p-3">
          <FilterOptionGroup
            label="Status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(status) => onChange({ ...filters, status })}
          />

          <FilterOptionGroup
            label="Type"
            options={SCHEDULE_OPTIONS}
            value={filters.schedule}
            onChange={(schedule) => onChange({ ...filters, schedule })}
            columns={2}
          />

          <FilterOptionGroup
            label="Range"
            options={SCOPE_OPTIONS}
            value={filters.scope}
            onChange={(scope) => onChange({ ...filters, scope })}
          />

          {!isDefault ? (
            <Pressable
              onPress={() => onChange(DEFAULT_LIST_FILTERS)}
              className="items-center rounded-lg py-2"
            >
              <Text className="text-xs font-semibold text-muted-foreground">Reset to default</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
