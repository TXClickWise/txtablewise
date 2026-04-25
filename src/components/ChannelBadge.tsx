import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Globe, Phone, MessageCircle, MessageSquare, Bot, UserPlus, Pencil, Sparkles } from "lucide-react";

const channelBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium border",
  {
    variants: {
      channel: {
        online: "bg-channel-online/10 text-channel-online border-channel-online/25",
        phone: "bg-channel-phone/10 text-channel-phone border-channel-phone/25",
        whatsapp: "bg-success/10 text-success border-success/25",
        sms: "bg-channel-phone/10 text-channel-phone border-channel-phone/25",
        webchat: "bg-channel-online/10 text-channel-online border-channel-online/25",
        walk_in: "bg-channel-walkin/10 text-channel-walkin border-channel-walkin/25",
        manual: "bg-muted text-muted-foreground border-border",
        ai_agent: "bg-channel-ai/10 text-channel-ai border-channel-ai/25",
      },
    },
    defaultVariants: { channel: "online" },
  }
);

const CHANNEL_LABELS: Record<string, string> = {
  online: "Online",
  phone: "Telefoon",
  whatsapp: "WhatsApp",
  sms: "SMS",
  webchat: "Webchat",
  walk_in: "Walk-in",
  manual: "Handmatig",
  ai_agent: "AI Host",
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  online: Globe,
  phone: Phone,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  webchat: MessageCircle,
  walk_in: UserPlus,
  manual: Pencil,
  ai_agent: Bot,
};

export interface ChannelBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof channelBadgeVariants> {}

export function ChannelBadge({ channel, className, ...props }: ChannelBadgeProps) {
  const key = channel ?? "online";
  const Icon = CHANNEL_ICONS[key] ?? Sparkles;
  return (
    <span className={cn(channelBadgeVariants({ channel }), className)} {...props}>
      <Icon className="h-3 w-3" />
      {CHANNEL_LABELS[key] ?? key}
    </span>
  );
}
