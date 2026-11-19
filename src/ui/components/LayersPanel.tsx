import {
  ArrowRight,
  Badge,
  Bookmark,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Circle,
  Cloud,
  Cross,
  Diamond,
  Eye,
  EyeOff,
  GripVertical,
  Group as GroupIcon,
  Heart,
  Hexagon,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  MinusCircle,
  Octagon,
  Paintbrush,
  Pentagon,
  Pill,
  RectangleHorizontal,
  Settings2,
  Shield,
  Square,
  Star,
  Trash2,
  Triangle,
  Unlock,
  Type,
  Unlink,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ColorPicker } from '@/ui/components/ColorPicker';
import { PropertiesPanel } from '@/ui/components/PropertiesPanel';
import { IconButton } from '@/ui/design-system';
import type { DecalData, ShapeType } from '@/ui/store/editor-store';
import { useEditorStore } from '@/ui/store/editor-store';

export function LayersPanel() {
  const {
    decals,
    removeDecal,
    setSelectedId,
    selectedIds,
    autoSelect,
    setAutoSelect,
    updateDecal,
    setDecalVisibility,
    setDecalLocked,
    reorderLayer,
    groupSelected,
    removeFromGroup,
    breakGroup,
    tshirtColor,
    setTshirtColor,
  } = useEditorStore();

  const [activePropertiesId, setActivePropertiesId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Keep the inspector anchored to the layer the user opened. Canvas selection
  // changes (including temporary camera gestures) must not open/close it.
  // Close only when that exact layer is removed, or when the user closes it.
  useEffect(() => {
    if (editingId) renameInputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (!activePropertiesId) return;
    if (!decals.some((decal) => decal.id === activePropertiesId)) {
      setActivePropertiesId(null);
      return;
    }
    // While the inspector is open, a deliberate single-layer selection switches
    // the inspector to that layer. Clearing selection does not close the panel.
    if (selectedIds.length === 1 && selectedIds[0] !== activePropertiesId) {
      setActivePropertiesId(selectedIds[0]);
    }
  }, [activePropertiesId, decals, selectedIds]);

  const { groups, standalone } = useMemo(() => {
    const g: Record<string, DecalData[]> = {};
    const s: DecalData[] = [];
    [...decals].reverse().forEach((d) => {
      if (d.groupId) {
        if (!g[d.groupId]) g[d.groupId] = [];
        g[d.groupId].push(d);
      } else {
        s.push(d);
      }
    });
    return { groups: g, standalone: s };
  }, [decals]);

  const handleNameSubmit = (id: string) => {
    if (editName.trim()) updateDecal(id, { name: editName.trim() });
    setEditingId(null);
  };

  const renderIcon = (type: string, shapeType?: ShapeType) => {
    const defaultProps = { size: 14, strokeWidth: 1.5 };
    if (type === 'text') return <Type {...defaultProps} />;
    if (type === 'image') return <ImageIcon {...defaultProps} />;
    if (shapeType) {
      switch (shapeType) {
        case 'circle':
          return <Circle {...defaultProps} />;
        case 'triangle':
          return <Triangle {...defaultProps} />;
        case 'star':
          return <Star {...defaultProps} />;
        case 'diamond':
          return <Diamond {...defaultProps} />;
        case 'hexagon':
          return <Hexagon {...defaultProps} />;
        case 'octagon':
          return <Octagon {...defaultProps} />;
        case 'pentagon':
          return <Pentagon {...defaultProps} />;
        case 'ellipse':
          return <Circle {...defaultProps} className="scale-x-125" />;
        case 'capsule':
          return <Pill {...defaultProps} />;
        case 'cross':
          return <Cross {...defaultProps} />;
        case 'heart':
          return <Heart {...defaultProps} />;
        case 'cloud':
          return <Cloud {...defaultProps} />;
        case 'arrow':
          return <ArrowRight {...defaultProps} />;
        case 'parallelogram':
          return <RectangleHorizontal {...defaultProps} className="skew-x-12" />;
        case 'trapezoid':
          return <Box {...defaultProps} />;
        case 'chat-bubble':
          return <MessageCircle {...defaultProps} />;
        case 'shield':
          return <Shield {...defaultProps} />;
        case 'badge':
          return <Badge {...defaultProps} />;
        case 'bookmark':
          return <Bookmark {...defaultProps} />;
        default:
          return <Square {...defaultProps} />;
      }
    }
    if (type === 'drawing') return <Paintbrush {...defaultProps} />;
    return <Square {...defaultProps} />;
  };

  const canGroup = selectedIds.length > 1;
  const canRemoveOrBreak = selectedIds.some(
    (id) => decals.find((d) => d.id === id)?.groupId !== undefined,
  );

  if (activePropertiesId) {
    const activeDecal = decals.find((d) => d.id === activePropertiesId);
    return (
      <div className="studio-layers-inspector flex flex-col h-full bg-[#fafaf9] overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
        <div className="studio-panel-heading h-16 flex items-center px-4 border-b border-stone-200/80 shrink-0 gap-3 bg-white">
          <IconButton onClick={() => setActivePropertiesId(null)} title="Back to layers" aria-label="Close layer properties" className="hover:bg-neutral-100">
            <ChevronLeft size={18} strokeWidth={1.5} className="text-black" />
          </IconButton>
          <div className="flex flex-col">
            <span className="font-bold text-[11px] uppercase tracking-[0.1em] text-black truncate max-w-[200px]">
              {activeDecal?.name || 'Unknown Layer'}
            </span>
            <span className="text-[9px] text-neutral-400 font-medium tracking-widest uppercase">
              Properties
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 hide-scrollbar">
          <PropertiesPanel activeDecalId={activePropertiesId} />
        </div>
      </div>
    );
  }

  const renderLayerItem = (decal: DecalData, isNested = false) => {
    const isSelected = selectedIds.includes(decal.id);
    const isEditing = editingId === decal.id;
    const siblingLayers = [...decals].reverse().filter((item) => item.groupId === decal.groupId);
    const siblingIndex = siblingLayers.findIndex((item) => item.id === decal.id);
    const layerAbove = siblingLayers[siblingIndex - 1];
    const layerBelow = siblingLayers[siblingIndex + 1];

    return (
      <div
        key={decal.id}
        draggable={!isEditing}
        onDragStart={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('button, input, select, textarea')) {
            event.preventDefault();
            return;
          }
          setDraggingLayerId(decal.id);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', decal.id);
        }}
        onDragOver={(event) => {
          if (!draggingLayerId || draggingLayerId === decal.id) return;
          const source = decals.find((item) => item.id === draggingLayerId);
          if (source?.groupId !== decal.groupId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          event.preventDefault();
          const sourceId = draggingLayerId || event.dataTransfer.getData('text/plain');
          const source = decals.find((item) => item.id === sourceId);
          if (source && source.groupId === decal.groupId && source.id !== decal.id) {
            reorderLayer(source.id, decal.id);
          }
          setDraggingLayerId(null);
        }}
        onDragEnd={() => setDraggingLayerId(null)}
        className={`flex flex-col overflow-hidden transition-colors duration-150 bg-transparent mb-1 ${draggingLayerId === decal.id ? 'opacity-45' : ''}`}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: the row groups layer actions, not form fields */}
        <div
          role="group"
          aria-label={`Layer controls for ${decal.name}`}
          data-selected={isSelected ? 'true' : 'false'}
          className={`studio-layer-row flex min-h-9 items-center justify-between gap-1 px-1.5 py-1 rounded-lg border transition-colors duration-150 ${isNested ? 'ml-4' : ''}`}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={`studio-layer-type-icon p-1 rounded-md shrink-0 ${isSelected ? 'is-selected' : ''}`}>
                  {renderIcon(decal.type, decal.shapeType)}
                </div>
                <input
                  ref={renameInputRef}
                  aria-label={`Rename layer ${decal.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleNameSubmit(decal.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSubmit(decal.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="text-[11px] font-medium bg-white text-black rounded-md px-2 py-1 outline-none w-full max-w-[140px] border border-black/10 min-w-0 flex-1"
                />
              </div>
            ) : (
              <button
                type="button"
                aria-label={`Select layer ${decal.name}`}
                aria-pressed={isSelected}
                onClick={(e) => setSelectedId(decal.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                onDoubleClick={() => {
                  setEditingId(decal.id);
                  setEditName(decal.name);
                }}
                className="studio-focusable flex items-center gap-2 flex-1 min-w-0 text-left rounded-md outline-none"
              >
                {decal.src && (decal.type === 'image' || decal.type === 'drawing') ? (
                  <img
                    src={decal.src}
                    alt=""
                    loading="lazy"
                    className="w-6 h-6 rounded-md border border-stone-200 bg-white object-contain shrink-0"
                  />
                ) : (
                  <div className={`studio-layer-type-icon w-6 h-6 flex items-center justify-center rounded-md shrink-0 ${isSelected ? 'is-selected' : ''}`}>
                    {renderIcon(decal.type, decal.shapeType)}
                  </div>
                )}
                <span className="studio-layer-name text-[11px] font-medium tracking-wide truncate min-w-0 flex-1">
                  {decal.name}
                </span>
              </button>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                title={decal.visible === false ? `Show ${decal.name}` : `Hide ${decal.name}`}
                aria-label={decal.visible === false ? `Show ${decal.name}` : `Hide ${decal.name}`}
                aria-pressed={decal.visible !== false}
                className="studio-layer-action w-7 h-7 rounded-md flex items-center justify-center outline-none studio-focusable"
                onClick={(event) => { event.stopPropagation(); setDecalVisibility(decal.id, decal.visible === false); }}
              >
                {decal.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                title={decal.locked ? `Unlock ${decal.name}` : `Lock ${decal.name}`}
                aria-label={decal.locked ? `Unlock ${decal.name}` : `Lock ${decal.name}`}
                aria-pressed={Boolean(decal.locked)}
                className={`studio-layer-action w-7 h-7 rounded-md flex items-center justify-center outline-none studio-focusable ${decal.locked ? 'is-active' : ''}`}
                onClick={(event) => { event.stopPropagation(); setDecalLocked(decal.id, !decal.locked); }}
              >
                {decal.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
              <button
                type="button"
                title={`Edit properties for ${decal.name}`}
                aria-label={`Open properties for ${decal.name}`}
                className="studio-layer-action w-7 h-7 rounded-md flex items-center justify-center outline-none studio-focusable"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!selectedIds.includes(decal.id)) setSelectedId(decal.id, false);
                  setActivePropertiesId(decal.id);
                }}
              >
                <Settings2 size={13} strokeWidth={1.5} />
              </button>
              <span className="w-px h-4 mx-0.5 bg-black/10" aria-hidden="true" />
              <button
                type="button"
                title={`Move ${decal.name} up`}
                aria-label={`Move ${decal.name} up`}
                disabled={!layerAbove}
                className="studio-layer-action w-6 h-7 rounded-md flex items-center justify-center outline-none studio-focusable disabled:opacity-20 disabled:cursor-not-allowed"
                onClick={(event) => { event.stopPropagation(); if (layerAbove) reorderLayer(decal.id, layerAbove.id); }}
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                title={`Move ${decal.name} down`}
                aria-label={`Move ${decal.name} down`}
                disabled={!layerBelow}
                className="studio-layer-action w-6 h-7 rounded-md flex items-center justify-center outline-none studio-focusable disabled:opacity-20 disabled:cursor-not-allowed"
                onClick={(event) => { event.stopPropagation(); if (layerBelow) reorderLayer(decal.id, layerBelow.id); }}
              >
                <ChevronDown size={13} />
              </button>
              <span className="w-5 h-7 flex items-center justify-center text-neutral-300 cursor-grab" title="Drag to reorder">
                <GripVertical size={12} />
              </span>
              <button
                type="button"
                title={`Delete ${decal.name}`}
                aria-label={`Delete ${decal.name}`}
                className="w-7 h-7 rounded-md flex items-center justify-center outline-none text-neutral-400 hover:text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400"
                onClick={(event) => { event.stopPropagation(); removeDecal(decal.id); }}
              >
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="studio-layers-panel flex flex-col h-full overflow-hidden">
      <div className="studio-global-settings p-3 sm:p-4 border-b border-stone-200/70 bg-[#fafaf9] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Global Settings
          </span>
        </div>

        <div className="mb-3 min-w-0">
          <ColorPicker
            color={tshirtColor}
            onChange={(color) => setTshirtColor(color === 'transparent' ? '#FFFFFF' : color)}
            disableAlpha={true}
          />
        </div>

        <div className="flex items-center justify-between px-1 shrink-0">
          <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-[0.2em] truncate pr-2">
            Auto-Select Layer
          </span>
          <button
            type="button"
            aria-pressed={autoSelect}
            aria-label="Toggle automatic layer selection"
            onClick={() => setAutoSelect(!autoSelect)}
            className={`w-9 h-5 rounded-full transition-colors relative outline-none shrink-0 ${autoSelect ? 'bg-black' : 'bg-neutral-200'}`}
            title="Auto-Select"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] shadow-sm transition-transform ${autoSelect ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
            />
          </button>
        </div>
      </div>

      <div className="studio-layers-heading px-3 sm:px-4 py-2.5 border-b border-stone-200/70 bg-white flex justify-between items-center shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Layers
        </span>
        <div className="flex gap-1.5 shrink-0">
          {canGroup && (
            <IconButton
              size="sm"
              onClick={groupSelected}
              title="Group"
              className="bg-[#fbfbfd] hover:bg-neutral-100 border border-black/5 text-black outline-none"
            >
              <GroupIcon size={14} strokeWidth={1.5} />
            </IconButton>
          )}
          {canRemoveOrBreak && (
            <>
              <IconButton
                size="sm"
                onClick={removeFromGroup}
                title="Ungroup"
                className="bg-[#fbfbfd] hover:bg-neutral-100 border border-black/5 outline-none"
              >
                <MinusCircle size={14} strokeWidth={1.5} className="text-orange-500" />
              </IconButton>
              <IconButton
                size="sm"
                onClick={breakGroup}
                title="Break"
                className="bg-[#fbfbfd] hover:bg-neutral-100 border border-black/5 outline-none"
              >
                <Unlink size={14} strokeWidth={1.5} className="text-red-500" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      <div className="studio-layers-list flex-1 min-h-0 overflow-y-auto p-2.5 hide-scrollbar bg-[#fafaf9]">
        {decals.length === 0 && (
          <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-stone-200">
            <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-[0.2em]">
              Canvas is Empty
            </span>
          </div>
        )}

        {standalone.map((decal) => renderLayerItem(decal, false))}

        {Object.entries(groups).map(([groupId, groupDecals], index) => {
          const isCollapsed = Boolean(collapsedGroups[groupId]);
          return (
            <div key={groupId} className="bg-white/80 border border-stone-200/70 rounded-xl p-2 mb-2 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => setCollapsedGroups((current) => ({ ...current, [groupId]: !current[groupId] }))}
                className="studio-layer-group-toggle w-full flex items-center gap-2 px-2 py-1.5 mb-1 text-left rounded-lg outline-none studio-focusable"
              >
                <GroupIcon size={13} strokeWidth={1.5} className="text-neutral-400 shrink-0" />
                <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.16em] truncate min-w-0 flex-1">
                  Group {index + 1} <span className="text-neutral-400 normal-case tracking-normal">· {groupDecals.length}</span>
                </span>
                <ChevronDown size={13} className={`text-neutral-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>
              {!isCollapsed && groupDecals.map((decal) => renderLayerItem(decal, true))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
