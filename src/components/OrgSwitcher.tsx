/**
 * Organization switcher dropdown component
 */

import { Check, ChevronsUpDown, Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useMultiOrg } from "@/hooks/useMultiOrg";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface OrgSwitcherProps {
  collapsed?: boolean;
}

export function OrgSwitcher({ collapsed = false }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    memberships,
    selectedOrgId,
    currentOrg,
    currentRole,
    isLoading,
    switchOrg,
  } = useMultiOrg();

  if (isLoading) {
    return (
      <div className="px-2 py-2">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!currentOrg) {
    return null;
  }

  const handleCreateOrg = () => {
    setOpen(false);
    navigate('/onboarding?new=true');
  };

  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label="Switch organization"
          >
            <Building2 className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start" side="right">
          <OrgList
            memberships={memberships}
            selectedOrgId={selectedOrgId}
            onSelect={(orgId) => {
              switchOrg(orgId);
              setOpen(false);
            }}
            onCreateOrg={handleCreateOrg}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between px-3 py-2 h-auto"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-[140px]">
                {currentOrg.name}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {currentRole}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <OrgList
          memberships={memberships}
          selectedOrgId={selectedOrgId}
          onSelect={(orgId) => {
            switchOrg(orgId);
            setOpen(false);
          }}
          onCreateOrg={handleCreateOrg}
        />
      </PopoverContent>
    </Popover>
  );
}

interface OrgListProps {
  memberships: Array<{
    org_id: string;
    role: string;
    org: { id: string; name: string; slug: string };
  }>;
  selectedOrgId: string | null;
  onSelect: (orgId: string) => void;
  onCreateOrg: () => void;
}

function OrgList({ memberships, selectedOrgId, onSelect, onCreateOrg }: OrgListProps) {
  return (
    <Command>
      <CommandInput placeholder="Search organizations..." />
      <CommandList>
        <CommandEmpty>No organization found.</CommandEmpty>
        <CommandGroup heading="Organizations">
          {memberships.map((membership) => (
            <CommandItem
              key={membership.org_id}
              value={membership.org.name}
              onSelect={() => onSelect(membership.org_id)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">{membership.org.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs capitalize">
                  {membership.role}
                </Badge>
              </div>
              <Check
                className={cn(
                  "ml-2 h-4 w-4 flex-shrink-0",
                  selectedOrgId === membership.org_id
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <CommandItem onSelect={onCreateOrg} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Create new organization
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
