import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GripVertical, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface Layer {
  id: string;
  type: string;
  content: string;
  position: {
    x?: number;
    y?: number;
    z_index: number;
  };
  style?: any;
  animation?: string;
  visible: boolean;
}

interface LayerBuilderProps {
  platform: 'youtube' | 'tiktok';
  qualityTier: 'starter' | 'pro' | 'enterprise';
  layers: Layer[];
  onChange: (layers: Layer[]) => void;
}

const QUALITY_TIER_LIMITS = {
  starter: 5,
  pro: 15,
  enterprise: 999
};

const LAYER_TYPES = [
  { value: 'background', label: 'Background', tier: 'starter' },
  { value: 'text', label: 'Text Overlay', tier: 'starter' },
  { value: 'logo', label: 'Logo', tier: 'starter' },
  { value: 'transition', label: 'Transition', tier: 'starter' },
  { value: 'subtitle', label: 'Subtitles', tier: 'pro' },
  { value: 'lower_third', label: 'Lower Third', tier: 'pro' },
  { value: 'effect', label: 'Visual Effect', tier: 'pro' },
  { value: 'cta_button', label: 'CTA Button', tier: 'pro' },
  { value: 'motion_graphics', label: 'Motion Graphics', tier: 'pro' },
  { value: 'particle_effect', label: 'Particle Effect', tier: 'pro' },
  { value: 'color_grade', label: 'Color Grading', tier: 'pro' },
  { value: 'end_screen', label: 'End Screen', tier: 'pro' },
  { value: 'intro_sequence', label: 'Intro Sequence', tier: 'pro' },
  { value: 'outro_sequence', label: 'Outro Sequence', tier: 'pro' },
  { value: 'sticker', label: 'Sticker', tier: 'pro' },
  { value: 'light_leak', label: 'Light Leak', tier: 'enterprise' },
  { value: 'lens_flare', label: 'Lens Flare', tier: 'enterprise' },
  { value: 'green_screen', label: 'Green Screen', tier: 'enterprise' },
];

export function LayerBuilder({ platform, qualityTier, layers, onChange }: LayerBuilderProps) {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const maxLayers = QUALITY_TIER_LIMITS[qualityTier];

  const addLayer = (type: string) => {
    if (layers.length >= maxLayers) {
      toast.error(`${qualityTier} tier allows max ${maxLayers} layers. Upgrade for more!`);
      return;
    }

    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type,
      content: '',
      position: { z_index: layers.length },
      visible: true
    };

    onChange([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
    toast.success(`Added ${type} layer`);
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    onChange(layers.map(layer => 
      layer.id === id ? { ...layer, ...updates } : layer
    ));
  };

  const deleteLayer = (id: string) => {
    onChange(layers.filter(layer => layer.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
    toast.success('Layer deleted');
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;
    
    const newLayers = [...layers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= layers.length) return;
    
    [newLayers[index], newLayers[targetIndex]] = [newLayers[targetIndex], newLayers[index]];
    
    // Update z_index
    newLayers.forEach((layer, idx) => {
      layer.position.z_index = idx;
    });
    
    onChange(newLayers);
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  const availableLayerTypes = LAYER_TYPES.filter(lt => {
    if (lt.tier === 'starter') return true;
    if (lt.tier === 'pro') return qualityTier === 'pro' || qualityTier === 'enterprise';
    if (lt.tier === 'enterprise') return qualityTier === 'enterprise';
    return false;
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Layer Stack */}
      <Card className="col-span-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            Layers ({layers.length}/{maxLayers})
          </h3>
          <Select onValueChange={addLayer}>
            <SelectTrigger className="w-[140px]">
              <Plus className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Add Layer" />
            </SelectTrigger>
            <SelectContent>
              {availableLayerTypes.map(lt => (
                <SelectItem key={lt.value} value={lt.value}>
                  {lt.label}
                  {lt.tier !== 'starter' && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({lt.tier})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {layers.map((layer, index) => (
            <Card
              key={layer.id}
              className={`p-3 cursor-pointer transition-colors ${
                selectedLayerId === layer.id ? 'border-primary' : ''
              }`}
              onClick={() => setSelectedLayerId(layer.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm capitalize">{layer.type}</p>
                    <p className="text-xs text-muted-foreground">z-index: {layer.position.z_index}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(layer.id, { visible: !layer.visible });
                    }}
                  >
                    {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayer(layer.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {layers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No layers yet. Add a layer to get started.
          </p>
        )}
      </Card>

      {/* Layer Editor */}
      <Card className="col-span-1 p-4">
        <h3 className="font-semibold mb-4">Layer Properties</h3>
        {selectedLayer ? (
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Input value={selectedLayer.type} disabled className="capitalize" />
            </div>
            <div>
              <Label>Content</Label>
              <Input
                value={selectedLayer.content}
                onChange={(e) => updateLayer(selectedLayer.id, { content: e.target.value })}
                placeholder="Enter content..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>X Position (%)</Label>
                <Input
                  type="number"
                  value={selectedLayer.position.x || 0}
                  onChange={(e) => updateLayer(selectedLayer.id, {
                    position: { ...selectedLayer.position, x: parseFloat(e.target.value) }
                  })}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <div>
                <Label>Y Position (%)</Label>
                <Input
                  type="number"
                  value={selectedLayer.position.y || 0}
                  onChange={(e) => updateLayer(selectedLayer.id, {
                    position: { ...selectedLayer.position, y: parseFloat(e.target.value) }
                  })}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
            <div>
              <Label>Animation</Label>
              <Select
                value={selectedLayer.animation || 'none'}
                onValueChange={(value) => updateLayer(selectedLayer.id, { animation: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="fade_in">Fade In</SelectItem>
                  <SelectItem value="slide_up">Slide Up</SelectItem>
                  <SelectItem value="zoom_in">Zoom In</SelectItem>
                  <SelectItem value="bounce_in">Bounce In</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Select a layer to edit its properties
          </p>
        )}
      </Card>

      {/* Preview */}
      <Card className="col-span-1 p-4">
        <h3 className="font-semibold mb-4">Preview</h3>
        <div className={`relative bg-muted rounded-lg overflow-hidden ${
          platform === 'youtube' ? 'aspect-video' : 'aspect-[9/16]'
        }`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {platform === 'youtube' ? '16:9' : '9:16'} Preview
            </p>
          </div>
          {layers
            .filter(l => l.visible)
            .sort((a, b) => a.position.z_index - b.position.z_index)
            .map(layer => (
              <div
                key={layer.id}
                className="absolute p-2 bg-primary/20 border border-primary rounded text-xs"
                style={{
                  left: `${layer.position.x || 50}%`,
                  top: `${layer.position.y || 50}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: layer.position.z_index
                }}
              >
                {layer.content || layer.type}
              </div>
            ))}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Quality: <span className="font-medium capitalize">{qualityTier}</span></p>
          <p>Layers: {layers.filter(l => l.visible).length} visible</p>
        </div>
      </Card>
    </div>
  );
}
