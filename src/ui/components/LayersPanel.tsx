import {
  ArrowRight,
  Badge,
  Bookmark,
  Box,
  ChevronDown,
  ChevronUp,
  Circle,
  Cloud,
  Cross,
  Diamond,
  Group as GroupIcon,
  Heart,
  Hexagon,
  Image as ImageIcon,
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
  Type,
  Unlink,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
    moveLayerUp,
    moveLayerDown,
    autoSelect,
    setAutoSelect,
    updateDecal,
    groupSelected,
    removeFromGroup,
    breakGroup,
    tshirtColor,
    setTshirtColor,
  } = useEditorStore();

  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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
        case 'rectangle':
          return <Square {...defaultProps} />;
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

  const renderLayerItem = (decal: DecalData, isNested = false) => {
    const isSelected = selectedIds.includes(decal.id);
    const isExpanded = expandedLayerId === decal.id;
    const isEditing = editingId === decal.id;

    return (
      <div
        key={decal.id}
        className={`flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'bg-[#f8f8f8] rounded-2xl border border-black/5 mb-3' : 'bg-transparent mb-1'}`}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Custom UI */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Custom UI */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-colors ${isNested && !isExpanded ? 'ml-6' : ''} ${isSelected && !isExpanded ? 'bg-black text-white shadow-md' : 'hover:bg-[#f5f5f7] text-black'}`}
          onClick={(e) => setSelectedId(decal.id, e.ctrlKey || e.metaKey || e.shiftKey)}
          onDoubleClick={() => {
            setEditingId(decal.id);
            setEditName(decal.name);
          }}
        >
          {/* min-w-0 enforces text truncation instead of container expansion */}
          <div className="flex items-center gap-3 overflow-hidden flex-1 pl-1 min-w-0">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${isSelected && !isExpanded ? 'text-white' : 'text-neutral-500'}`}
            >
              {renderIcon(decal.type, decal.shapeType)}
            </div>
            {isEditing ? (
              <input
                // biome-ignore lint/a11y/noAutofocus: Intentional UI behavior
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleNameSubmit(decal.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit(decal.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="text-[11px] font-medium tracking-wide bg-white text-black rounded-md px-2 py-1 outline-none w-full max-w-[140px] border border-black/10 min-w-0 flex-1"
              />
            ) : (
              <span
                className={`text-[11px] font-medium tracking-wide truncate min-w-0 flex-1 ${isSelected && !isExpanded ? 'text-white' : 'text-neutral-700'}`}
              >
                {decal.name}
              </span>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1 shrink-0 pr-1">
              <IconButton
                size="sm"
                className={`transition-colors outline-none shrink-0 ${isExpanded ? 'bg-black/5 text-black' : isSelected ? 'text-white/80 hover:text-white' : 'text-neutral-400 hover:text-black'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectedIds.includes(decal.id)) setSelectedId(decal.id, false);
                  setExpandedLayerId(isExpanded ? null : decal.id);
                }}
              >
                <Settings2 size={14} strokeWidth={1.5} />
              </IconButton>
              <div
                className={`w-px h-4 mx-1 shrink-0 ${isSelected && !isExpanded ? 'bg-white/30' : 'bg-black/10'}`}
              />
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  className={`p-0.5 rounded outline-none transition-colors ${isSelected && !isExpanded ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-neutral-400 hover:text-black hover:bg-black/5'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayerUp(decal.id);
                  }}
                >
                  <ChevronUp size={12} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className={`p-0.5 rounded outline-none transition-colors ${isSelected && !isExpanded ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-neutral-400 hover:text-black hover:bg-black/5'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayerDown(decal.id);
                  }}
                >
                  <ChevronDown size={12} strokeWidth={2} />
                </button>
              </div>
              <IconButton
                size="sm"
                className="outline-none ml-1 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDecal(decal.id);
                }}
              >
                <Trash2
                  size={14}
                  strokeWidth={1.5}
                  className={
                    isSelected && !isExpanded
                      ? 'text-white hover:text-red-300'
                      : 'text-neutral-400 hover:text-red-500'
                  }
                />
              </IconButton>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="p-4 pt-2 border-t border-black/5 animate-in slide-in-from-top-2 duration-200">
            <PropertiesPanel activeDecalId={decal.id} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      <div className="p-6 border-b border-black/[0.04] bg-transparent shrink-0">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
            Global Settings
          </span>
        </div>

        <div className="mb-5 min-w-0">
          <ColorPicker
            color={tshirtColor}
            onChange={(color) => setTshirtColor(color === 'transparent' ? '#FFFFFF' : color)}
            disableAlpha={true}
          />
        </div>

        {/* Minimal iOS-style Toggle */}
        <div className="flex items-center justify-between px-1 shrink-0">
          <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-[0.2em] truncate pr-2">
            Auto-Select Layer
          </span>
          <button
            type="button"
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

      <div className="px-6 py-4 border-b border-black/[0.04] bg-transparent flex justify-between items-center shrink-0">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
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

      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar bg-transparent">
        {decals.length === 0 && (
          <div className="text-center p-10 bg-[#fbfbfd] rounded-3xl border border-black/[0.04]">
            <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-[0.2em]">
              Canvas is Empty
            </span>
          </div>
        )}

        {standalone.map((decal) => renderLayerItem(decal, false))}

        {Object.entries(groups).map(([groupId, groupDecals], index) => (
          <div
            key={groupId}
            className="bg-[#fbfbfd] border border-black/[0.04] rounded-3xl p-2.5 mb-5"
          >
            <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
              <GroupIcon size={14} strokeWidth={1.5} className="text-neutral-400 shrink-0" />
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.2em] truncate min-w-0">
                Group {index + 1}
              </span>
            </div>
            {groupDecals.map((decal) => renderLayerItem(decal, true))}
          </div>
        ))}
      </div>
    </div>
  );
}
