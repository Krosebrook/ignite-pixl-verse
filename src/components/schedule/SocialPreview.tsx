import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Repeat2, Share, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialPreviewProps {
  platform: string;
  content?: string;
  imageUrl?: string;
  username?: string;
  avatarUrl?: string;
}

export function SocialPreview({ 
  platform, 
  content = "Your post content will appear here...", 
  imageUrl,
  username = "yourhandle",
  avatarUrl 
}: SocialPreviewProps) {
  const [selectedPlatform, setSelectedPlatform] = useState(platform);

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Post Preview</h3>
      <Tabs value={selectedPlatform} onValueChange={setSelectedPlatform}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
          <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
        </TabsList>

        <TabsContent value="instagram" className="mt-0">
          <InstagramPreview 
            content={content} 
            imageUrl={imageUrl} 
            username={username} 
            avatarUrl={avatarUrl} 
          />
        </TabsContent>

        <TabsContent value="twitter" className="mt-0">
          <TwitterPreview 
            content={content} 
            imageUrl={imageUrl} 
            username={username} 
            avatarUrl={avatarUrl} 
          />
        </TabsContent>

        <TabsContent value="linkedin" className="mt-0">
          <LinkedInPreview 
            content={content} 
            imageUrl={imageUrl} 
            username={username} 
            avatarUrl={avatarUrl} 
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function InstagramPreview({ content, imageUrl, username, avatarUrl }: Omit<SocialPreviewProps, 'platform'>) {
  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden max-w-[350px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
            {username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold text-sm">{username}</span>
        <MoreHorizontal className="h-4 w-4 ml-auto text-muted-foreground" />
      </div>

      {/* Image */}
      <div className="aspect-square bg-muted flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
        ) : (
          <div className="text-muted-foreground text-sm">Image Preview</div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6 cursor-pointer hover:text-red-500 transition-colors" />
          <MessageCircle className="h-6 w-6 cursor-pointer" />
          <Send className="h-6 w-6 cursor-pointer" />
          <Bookmark className="h-6 w-6 ml-auto cursor-pointer" />
        </div>
        <p className="font-semibold text-sm">0 likes</p>
        <p className="text-sm">
          <span className="font-semibold">{username}</span>{" "}
          <span className="text-foreground/80">{content}</span>
        </p>
        <p className="text-xs text-muted-foreground uppercase">Just now</p>
      </div>
    </div>
  );
}

function TwitterPreview({ content, imageUrl, username, avatarUrl }: Omit<SocialPreviewProps, 'platform'>) {
  return (
    <div className="bg-background border border-border rounded-xl p-4 max-w-[500px] mx-auto">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm truncate">{username}</span>
            <span className="text-muted-foreground text-sm">@{username}</span>
            <span className="text-muted-foreground text-sm">· now</span>
            <MoreHorizontal className="h-4 w-4 ml-auto text-muted-foreground" />
          </div>

          <p className="text-sm mt-1 whitespace-pre-wrap">{content}</p>

          {imageUrl && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border">
              <img src={imageUrl} alt="Post" className="w-full object-cover max-h-[300px]" />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 max-w-[400px] text-muted-foreground">
            <div className="flex items-center gap-1 hover:text-primary cursor-pointer">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">0</span>
            </div>
            <div className="flex items-center gap-1 hover:text-green-500 cursor-pointer">
              <Repeat2 className="h-4 w-4" />
              <span className="text-xs">0</span>
            </div>
            <div className="flex items-center gap-1 hover:text-red-500 cursor-pointer">
              <Heart className="h-4 w-4" />
              <span className="text-xs">0</span>
            </div>
            <div className="flex items-center gap-1 hover:text-primary cursor-pointer">
              <Share className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ content, imageUrl, username, avatarUrl }: Omit<SocialPreviewProps, 'platform'>) {
  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden max-w-[500px] mx-auto">
      {/* Header */}
      <div className="p-4 flex gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-[#0a66c2] text-white">
            {username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold text-sm">{username}</p>
          <p className="text-xs text-muted-foreground">Your headline here</p>
          <p className="text-xs text-muted-foreground">Just now · 🌐</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="border-t border-b border-border">
          <img src={imageUrl} alt="Post" className="w-full object-cover max-h-[350px]" />
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="flex -space-x-1">
            <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
              <ThumbsUp className="h-2.5 w-2.5 text-white" />
            </div>
            <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
              <Heart className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
          <span>0</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around py-2 px-4">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-1.5 px-3 py-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
