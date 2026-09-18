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
import { useEffect, useMemo, useState } from 'react';
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

  // Local state for the hex input to prevent React controlled/uncontrolled warnings
  const [localHexColor, setLocalHexColor] = useState(tshirtColor);

  useEffect(() => {
    setLocalHexColor(tshirtColor);
  }, [tshirtColor]);

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
    if (type === 'text') return <Type size={16} className="text-black" />;
    if (type === 'image') return <ImageIcon size={16} className="text-black" />;
    if (shapeType) {
      const className = 'text-black';
      switch (shapeType) {
        case 'rectangle':
          return <Square size={16} className={className} />;
        case 'circle':
          return <Circle size={16} className={className} />;
        case 'triangle':
          return <Triangle size={16} className={className} />;
        case 'star':
          return <Star size={16} className={className} />;
        case 'diamond':
          return <Diamond size={16} className={className} />;
        case 'hexagon':
          return <Hexagon size={16} className={className} />;
        case 'octagon':
          return <Octagon size={16} className={className} />;
        case 'pentagon':
          return <Pentagon size={16} className={className} />;
        case 'ellipse':
          return <Circle size={16} className={`scale-x-125 ${className}`} />;
        case 'capsule':
          return <Pill size={16} className={className} />;
        case 'cross':
          return <Cross size={16} className={className} />;
        case 'heart':
          return <Heart size={16} className={className} />;
        case 'cloud':
          return <Cloud size={16} className={className} />;
        case 'arrow':
          return <ArrowRight size={16} className={className} />;
        case 'parallelogram':
          return <RectangleHorizontal size={16} className={`skew-x-12 ${className}`} />;
        case 'trapezoid':
          return <Box size={16} className={className} />;
        case 'chat-bubble':
          return <MessageCircle size={16} className={className} />;
        case 'shield':
          return <Shield size={16} className={className} />;
        case 'badge':
          return <Badge size={16} className={className} />;
        case 'bookmark':
          return <Bookmark size={16} className={className} />;
        default:
          return <Square size={16} className={className} />;
      }
    }
    if (type === 'drawing') return <Paintbrush size={16} className="text-black" />;
    return <Square size={16} className="text-black" />;
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
        className={`flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'bg-neutral-50/80 rounded-3xl border border-black/5 shadow-inner mb-3' : 'bg-transparent mb-1'}`}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Custom UI list item */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Custom UI list item */}
        <div
          className={`flex items-center justify-between p-2 rounded-2xl cursor-pointer transition-colors ${isNested && !isExpanded ? 'ml-6' : ''} ${isSelected && !isExpanded ? 'bg-black text-white shadow-md' : 'hover:bg-black/5 text-black'}`}
          onClick={(e) => setSelectedId(decal.id, e.ctrlKey || e.metaKey || e.shiftKey)}
          onDoubleClick={() => {
            setEditingId(decal.id);
            setEditName(decal.name);
          }}
        >
          <div className="flex items-center gap-3 overflow-hidden flex-1 pl-1">
            <div
              className={`p-1.5 rounded-xl ${isSelected && !isExpanded ? 'bg-white/20 text-white' : 'bg-black/5 text-black'}`}
            >
              {renderIcon(decal.type, decal.shapeType)}
            </div>
            {isEditing ? (
              <input
                // biome-ignore lint/a11y/noAutofocus: Intentional
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleNameSubmit(decal.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit(decal.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="text-xs font-bold bg-white text-black rounded px-2 py-1 outline-none w-full max-w-[120px] shadow-inner"
              />
            ) : (
              <span
                className={`text-[11px] font-bold truncate ${isSelected && !isExpanded ? 'text-white' : 'text-neutral-800'}`}
              >
                {decal.name}
              </span>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1 shrink-0 pr-1">
              <IconButton
                size="sm"
                className={`transition-colors ${isExpanded ? 'bg-black/10 text-black' : isSelected ? 'text-white/80 hover:text-white' : 'text-neutral-400 hover:text-black'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectedIds.includes(decal.id)) setSelectedId(decal.id, false);
                  setExpandedLayerId(isExpanded ? null : decal.id);
                }}
              >
                <Settings2 size={16} />
              </IconButton>
              <div
                className={`w-px h-5 mx-0.5 ${isSelected && !isExpanded ? 'bg-white/30' : 'bg-black/10'}`}
              />
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className={`p-0.5 rounded hover:bg-black/20 transition-colors ${isSelected && !isExpanded ? 'text-white/80 hover:text-white' : 'text-neutral-400 hover:text-black'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayerUp(decal.id);
                  }}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  className={`p-0.5 rounded hover:bg-black/20 transition-colors ${isSelected && !isExpanded ? 'text-white/80 hover:text-white' : 'text-neutral-400 hover:text-black'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayerDown(decal.id);
                  }}
                >
                  <ChevronDown size={12} />
                </button>
              </div>
              <IconButton
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDecal(decal.id);
                }}
              >
                <Trash2
                  size={16}
                  className={
                    isSelected && !isExpanded
                      ? 'text-red-300 hover:text-red-400'
                      : 'text-red-400 hover:text-red-600'
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
      <div className="p-5 border-b border-black/5 bg-transparent shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
            Workspace Settings
          </span>
        </div>
        <div className="flex gap-2 p-1.5 bg-black/5 rounded-2xl items-center">
          <input
            type="color"
            value={tshirtColor}
            onChange={(e) => setTshirtColor(e.target.value)}
            className="w-8 h-8 rounded-xl cursor-pointer p-0 border-0 shrink-0 bg-transparent"
          />
          <input
            value={localHexColor}
            onChange={(e) => setLocalHexColor(e.target.value)}
            onBlur={(e) => {
              let finalColor = e.target.value.trim();
              const ctx = document.createElement('canvas').getContext('2d');
              if (ctx && finalColor) {
                ctx.fillStyle = finalColor;
                finalColor = ctx.fillStyle;
              }
              setTshirtColor(finalColor);
              setLocalHexColor(finalColor);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="flex-1 font-mono uppercase text-[11px] font-bold bg-transparent border-0 focus:ring-0 text-black px-2 outline-none"
          />
        </div>
        <div className="mt-4 flex items-center justify-between px-1">
          <span className="text-[10px] text-neutral-600 font-extrabold uppercase tracking-widest">
            Auto-Select
          </span>
          <button
            type="button"
            onClick={() => setAutoSelect(!autoSelect)}
            className={`w-9 h-5 rounded-full transition-colors relative shadow-inner ${autoSelect ? 'bg-black' : 'bg-black/10'}`}
            title="Auto-Select"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] shadow-sm transition-transform ${autoSelect ? 'left-4' : 'left-[3px]'}`}
            />
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-black/5 bg-transparent flex justify-between items-center shrink-0">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
          Layers
        </span>
        <div className="flex gap-1">
          {canGroup && (
            <IconButton size="sm" onClick={groupSelected} title="Group">
              <GroupIcon size={14} className="text-black" />
            </IconButton>
          )}
          {canRemoveOrBreak && (
            <>
              <IconButton size="sm" onClick={removeFromGroup} title="Ungroup">
                <MinusCircle size={14} className="text-orange-500" />
              </IconButton>
              <IconButton size="sm" onClick={breakGroup} title="Break">
                <Unlink size={14} className="text-red-500" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-transparent">
        {decals.length === 0 && (
          <div className="text-center p-8 bg-neutral-50 rounded-3xl border border-black/5 border-dashed">
            <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">
              No Layers Yet
            </span>
          </div>
        )}
        {standalone.map((decal) => renderLayerItem(decal, false))}
        {Object.entries(groups).map(([groupId, groupDecals], index) => (
          <div key={groupId} className="bg-black/5 rounded-[2rem] p-2 mb-4 border border-black/5">
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <GroupIcon size={14} className="text-neutral-400" />
              <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest">
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
