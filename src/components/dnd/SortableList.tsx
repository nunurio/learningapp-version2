"use client";
import * as React from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  defaultDropAnimation,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent, DropAnimation } from "@dnd-kit/core";
import {
  arrayMove,
  defaultAnimateLayoutChanges,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";

type MaybePromise<T> = T | Promise<T>;

type SortableListProps = {
  ids: string[];
  label: string;
  onReorder: (ids: string[]) => MaybePromise<void>;
  renderItem: (id: string, index: number) => React.ReactNode;
};

export function SortableList({ ids, label, onReorder, renderItem }: SortableListProps) {
  const [items, setItems] = React.useState(ids);
  const lastReceivedIdsRef = React.useRef(ids);
  const dragStartItemsRef = React.useRef<string[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  React.useEffect(() => {
    const prev = lastReceivedIdsRef.current;
    const changed =
      prev.length !== ids.length ||
      prev.some((prevId, index) => prevId !== ids[index]);
    lastReceivedIdsRef.current = ids;
    if (changed) {
      setItems(ids);
    }
  }, [ids]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragStart(event: DragStartEvent) {
    const { active } = event;
    dragStartItemsRef.current = [...items];
    setActiveId(String(active.id));
  }

  function onDragCancel() {
    setActiveId(null);
    if (dragStartItemsRef.current) {
      setItems(dragStartItemsRef.current);
    }
    dragStartItemsRef.current = null;
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) {
      if (dragStartItemsRef.current) {
        setItems(dragStartItemsRef.current);
      }
      dragStartItemsRef.current = null;
      return;
    }
    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const previous = [...items];
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    dragStartItemsRef.current = null;
    const maybe = onReorder(next);
    if (maybe && typeof (maybe as Promise<void>).catch === "function") {
      (maybe as Promise<void>).catch(() => {
        setItems(previous);
      });
    }
  }

  const dropAnimation: DropAnimation = {
    ...defaultDropAnimation,
    duration: 180,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  };

  const activeIndex = activeId ? items.indexOf(activeId) : -1;
  const activeItemId = activeId && activeIndex >= 0 ? activeId : null;
  const activeNode = activeItemId ? renderItem(activeItemId, activeIndex) : null;

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
      onDragStart={onDragStart}
      onDragCancel={onDragCancel}
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
      {isMounted && createPortal(
        <DragOverlay dropAnimation={dropAnimation}>
          {activeId && activeNode ? (
            <SortableOverlay index={activeIndex}>{activeNode}</SortableOverlay>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

function SortableRow({ id, index, children }: { id: string; index: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id,
    animateLayoutChanges: (args) => {
      if (args.isSorting || args.isDragging) return false;
      return defaultAnimateLayoutChanges(args);
    },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
    opacity: isDragging ? 0.7 : undefined,
    zIndex: isDragging ? 40 : undefined,
    willChange: "transform",
  };
  return (
    <li ref={setNodeRef} style={style} className={itemClassName}>
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          aria-label={`ドラッグして並び替え（#${index + 1})`}
          className="cursor-grab select-none text-gray-500 px-1"
          style={{ touchAction: "none" }}
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

const itemClassName = "rounded-md border border-[hsl(220_13%_85%_/_0.8)] bg-[hsl(var(--card))] p-3 shadow-sm hover:border-[hsl(220_13%_75%)] hover:shadow-md transition-all duration-200";

function SortableOverlay({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div className={`${itemClassName} pointer-events-none`} aria-hidden>
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="cursor-grabbing select-none text-gray-500 px-1">≡</div>
        <span className="text-gray-500 select-none hidden sm:inline">#{index + 1}</span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
