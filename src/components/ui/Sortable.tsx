"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type DragHandleProps = HTMLAttributes<HTMLElement> & {
  ref?: (el: HTMLElement | null) => void;
};

interface SortableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (next: T[]) => void;
  disabled?: boolean;
  className?: string;
  children: (item: T, index: number) => ReactNode;
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  disabled,
  className,
  children,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(items, oldIdx, newIdx));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={disabled ? undefined : handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {className ? (
          <div className={className}>{items.map((item, idx) => children(item, idx))}</div>
        ) : (
          <>{items.map((item, idx) => children(item, idx))}</>
        )}
      </SortableContext>
    </DndContext>
  );
}

interface SortableItemRenderArgs {
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  dragHandleProps: DragHandleProps;
}

interface SortableItemProps {
  id: string;
  disabled?: boolean;
  children: (args: SortableItemRenderArgs) => ReactNode;
}

export function SortableItem({ id, disabled, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  return (
    <>
      {children({
        setNodeRef,
        style,
        isDragging,
        dragHandleProps: { ...attributes, ...listeners } as DragHandleProps,
      })}
    </>
  );
}

interface DragHandleButtonProps {
  dragHandleProps: DragHandleProps;
  label: string;
  className?: string;
  size?: "sm" | "md";
}

export function DragHandle({
  dragHandleProps,
  label,
  className,
  size = "md",
}: DragHandleButtonProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      aria-label={label}
      title="Drag to reorder"
      className={`cursor-grab touch-none rounded-sm p-1 text-foreground-subtle hover:text-foreground hover:bg-surface-muted active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
      {...(dragHandleProps as HTMLAttributes<HTMLButtonElement>)}
    >
      <GripVertical className={iconSize} aria-hidden="true" />
    </button>
  );
}
