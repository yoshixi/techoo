import type { TodosViewMode } from '@/lib/todosScreenIntent';
import { UnderlineTabRow } from '@/components/ui/underline-tabs';

export function TodosViewSegment({
  value,
  onChange,
}: {
  value: TodosViewMode;
  onChange: (mode: TodosViewMode) => void;
}) {
  return (
    <UnderlineTabRow
      value={value}
      onChange={onChange}
      options={[
        { value: 'timeline', label: 'Schedule' },
        { value: 'list', label: 'List' },
      ]}
    />
  );
}
