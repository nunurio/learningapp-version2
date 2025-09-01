"use client";
import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableListProps = {
  ids: string[];
  label: string;
  onReorder: (ids: string[]) => void;
  renderItem: (id: string, index: number) => React.ReactNode;
};

export function SortableList({ ids, label, onReorder, renderItem }: SortableListProps) {
  const [items, setItems] = React.useState(ids);
  React.useEffect(() => setItems(ids), [ids]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    onReorder(next);
  }

  const announcements = {
    onDragStart(id: string) {
      return `${label}: ${id} を移動中`;
    },
    onDragOver(id: string, overId: string) {
      return `${label}: ${id} を ${overId} の位置へ`;
    },
    onDragEnd(id: string, overId: string) {
      return `${label}: ${id} を ${overId} の位置に移動しました`;
    },
    onDragCancel(id: string) {
      return `${label}: ${id} の移動をキャンセル`;
    },
  } as const;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return announcements.onDragStart(String(active.id));
          },
          onDragOver({ active, over }) {
            if (!over) return;
            return announcements.onDragOver(String(active.id), String(over.id));
          },
          onDragEnd({ active, over }) {
            if (!over) return;
            return announcements.onDragEnd(String(active.id), String(over.id));
          },
          onDragCancel({ active }) {
            return announcements.onDragCancel(String(active.id));
          },
        },
      }}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {items.map((id, index) => (
            <SortableRow key={id} id={id} index={index}>
              {renderItem(id, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, index, children }: { id: string; index: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : undefined,
  };
  return (
    <li ref={setNodeRef} style={style} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          aria-label={`ドラッグして並び替え（#${index + 1})`}
          className="cursor-grab select-none text-gray-500 px-1"
          {...attributes}
          {...listeners}
          type="button"
        >
          ≡
        </button>
        <span className="text-gray-500 select-none hidden sm:inline">#{index + 1}</span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </li>
  );
}
