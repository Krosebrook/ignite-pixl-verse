import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Palette, Upload, Plus, X } from "lucide-react";

interface BrandKit {
  id: string;
  name: string;
  logo_url: string | null;
  colors: Array<{ name: string; hex: string }>;
  fonts: Array<{ name: string; family: string }>;
  guidelines: string | null;
}

export default function BrandKit() {
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [selectedKit, setSelectedKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBrandKits();
  }, []);

  const loadBrandKits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { data, error } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('org_id', membership.org_id);

      if (error) throw error;

      const mappedData = (data || []).map(kit => ({
        ...kit,
        colors: (kit.colors as any) || [],
        fonts: (kit.fonts as any) || [],
      }));
      setBrandKits(mappedData);
      if (mappedData.length > 0) {
        setSelectedKit(mappedData[0]);
      }
    } catch (error) {
      console.error('Load brand kits error:', error);
      toast({
        title: "Error",
        description: "Failed to load brand kits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedKit) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedKit.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('brand-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('brand-logos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('brand_kits')
        .update({ logo_url: publicUrl })
        .eq('id', selectedKit.id);

      if (updateError) throw updateError;

      setSelectedKit({ ...selectedKit, logo_url: publicUrl });
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const addColor = () => {
    if (!selectedKit) return;
    const newColor = { name: "New Color", hex: "#000000" };
    setSelectedKit({
      ...selectedKit,
      colors: [...(selectedKit.colors || []), newColor],
    });
  };

  const updateColor = (index: number, field: 'name' | 'hex', value: string) => {
    if (!selectedKit) return;
    const updatedColors = [...selectedKit.colors];
    updatedColors[index][field] = value;
    setSelectedKit({ ...selectedKit, colors: updatedColors });
  };

  const removeColor = (index: number) => {
    if (!selectedKit) return;
    const updatedColors = selectedKit.colors.filter((_, i) => i !== index);
    setSelectedKit({ ...selectedKit, colors: updatedColors });
  };

  const addFont = () => {
    if (!selectedKit) return;
    const newFont = { name: "New Font", family: "Inter" };
    setSelectedKit({
      ...selectedKit,
      fonts: [...(selectedKit.fonts || []), newFont],
    });
  };

  const updateFont = (index: number, field: 'name' | 'family', value: string) => {
    if (!selectedKit) return;
    const updatedFonts = [...selectedKit.fonts];
    updatedFonts[index][field] = value;
    setSelectedKit({ ...selectedKit, fonts: updatedFonts });
  };

  const removeFont = (index: number) => {
    if (!selectedKit) return;
    const updatedFonts = selectedKit.fonts.filter((_, i) => i !== index);
    setSelectedKit({ ...selectedKit, fonts: updatedFonts });
  };

  const saveBrandKit = async () => {
    if (!selectedKit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('brand_kits')
        .update({
          name: selectedKit.name,
          colors: selectedKit.colors,
          fonts: selectedKit.fonts,
          guidelines: selectedKit.guidelines,
        })
        .eq('id', selectedKit.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Brand kit saved successfully",
      });
      loadBrandKits();
    } catch (error) {
      console.error('Save brand kit error:', error);
      toast({
        title: "Error",
        description: "Failed to save brand kit",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createNewBrandKit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { data, error } = await supabase
        .from('brand_kits')
        .insert({
          org_id: membership.org_id,
          name: "New Brand Kit",
          colors: [],
          fonts: [],
        })
        .select()
        .single();

      if (error) throw error;

      const mappedData = {
        ...data,
        colors: (data.colors as any) || [],
        fonts: (data.fonts as any) || [],
      };

      toast({
        title: "Success",
        description: "New brand kit created",
      });
      loadBrandKits();
      setSelectedKit(mappedData);
    } catch (error) {
      console.error('Create brand kit error:', error);
      toast({
        title: "Error",
        description: "Failed to create brand kit",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!selectedKit) {
    return (
      <div className="container mx-auto py-8">
        <PageHeader
          title="Brand Kit"
          description="Define your brand identity"
          icon={Palette}
        />
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>No Brand Kit Found</CardTitle>
            <CardDescription>Create your first brand kit to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={createNewBrandKit}>
              <Plus className="h-4 w-4 mr-2" />
              Create Brand Kit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title="Brand Kit"
        description="Define your brand identity"
        icon={Palette}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={createNewBrandKit}>
              <Plus className="h-4 w-4 mr-2" />
              New Kit
            </Button>
            <Button onClick={saveBrandKit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Brand Name & Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Identity</CardTitle>
            <CardDescription>Name and logo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                value={selectedKit.name}
                onChange={(e) => setSelectedKit({ ...selectedKit, name: e.target.value })}
                placeholder="My Brand"
              />
            </div>

            <div>
              <Label>Logo</Label>
              {selectedKit.logo_url && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                  <img
                    src={selectedKit.logo_url}
                    alt="Brand logo"
                    className="h-20 object-contain"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Logo"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Colors</CardTitle>
            <CardDescription>Define your color palette</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedKit.colors?.map((color, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={color.name}
                  onChange={(e) => updateColor(index, 'name', e.target.value)}
                  placeholder="Color name"
                  className="flex-1"
                />
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(index, 'hex', e.target.value)}
                  className="w-12 h-10 rounded border cursor-pointer"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeColor(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addColor} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Color
            </Button>
          </CardContent>
        </Card>

        {/* Brand Fonts */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Fonts</CardTitle>
            <CardDescription>Typography settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedKit.fonts?.map((font, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={font.name}
                  onChange={(e) => updateFont(index, 'name', e.target.value)}
                  placeholder="Font usage (e.g., Headings)"
                  className="flex-1"
                />
                <Input
                  value={font.family}
                  onChange={(e) => updateFont(index, 'family', e.target.value)}
                  placeholder="Font family"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFont(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addFont} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Font
            </Button>
          </CardContent>
        </Card>

        {/* Brand Guidelines */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Brand Guidelines</CardTitle>
            <CardDescription>Voice, tone, and style guidelines</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={selectedKit.guidelines || ""}
              onChange={(e) => setSelectedKit({ ...selectedKit, guidelines: e.target.value })}
              placeholder="Describe your brand voice, tone, messaging guidelines, and any specific rules for content creation..."
              className="min-h-[200px]"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
