import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, GitBranch, Tag, GitCommit, Loader2 } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type RefType = "tag" | "branch" | "commit";

interface GitRef {
  type: RefType;
  name: string;
  sha: string;
  displayName: string;
}

interface RefSearchComboboxProps {
  repo: string; // format: "owner/repo"
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const GITHUB_API = "https://api.github.com";

async function fetchTags(repo: string): Promise<GitRef[]> {
  const response = await fetch(`${GITHUB_API}/repos/${repo}/tags?per_page=30`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.map((tag: { name: string; commit: { sha: string } }) => ({
    type: "tag" as RefType,
    name: tag.name,
    sha: tag.commit.sha,
    displayName: tag.name,
  }));
}

async function fetchBranches(repo: string): Promise<GitRef[]> {
  const response = await fetch(`${GITHUB_API}/repos/${repo}/branches?per_page=30`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.map((branch: { name: string; commit: { sha: string } }) => ({
    type: "branch" as RefType,
    name: branch.name,
    sha: branch.commit.sha,
    displayName: branch.name,
  }));
}

async function searchCommits(repo: string, query: string): Promise<GitRef[]> {
  if (!query || query.length < 4) return [];
  
  // Try to fetch commit by SHA prefix
  const response = await fetch(`${GITHUB_API}/repos/${repo}/commits?sha=${query}&per_page=10`);
  if (!response.ok) return [];
  
  const data = await response.json();
  return data.map((commit: { sha: string; commit: { message: string } }) => ({
    type: "commit" as RefType,
    name: commit.sha,
    sha: commit.sha,
    displayName: `${commit.sha.slice(0, 7)} - ${commit.commit.message.split("\n")[0].slice(0, 50)}`,
  }));
}

const RefIcon = ({ type }: { type: RefType }) => {
  switch (type) {
    case "tag":
      return <Tag className="h-4 w-4 text-amber-500" />;
    case "branch":
      return <GitBranch className="h-4 w-4 text-green-500" />;
    case "commit":
      return <GitCommit className="h-4 w-4 text-blue-500" />;
  }
};

export function RefSearchCombobox({
  repo,
  value,
  onChange,
  placeholder = "Search tags, branches, or commits...",
  disabled = false,
}: RefSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<GitRef[]>([]);
  const [branches, setBranches] = useState<GitRef[]>([]);
  const [commits, setCommits] = useState<GitRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // Load tags and branches when popover opens or repo changes
  useEffect(() => {
    if (!open || !repo) return;

    let cancelled = false;
    setInitialLoading(true);

    Promise.all([fetchTags(repo), fetchBranches(repo)])
      .then(([tagsData, branchesData]) => {
        if (!cancelled) {
          setTags(tagsData);
          setBranches(branchesData);
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, repo]);

  // Search commits with debounce
  const searchCommitsDebounced = useCallback(
    async (query: string) => {
      if (!repo || query.length < 4) {
        setCommits([]);
        return;
      }

      setLoading(true);
      try {
        const results = await searchCommits(repo, query);
        setCommits(results);
      } finally {
        setLoading(false);
      }
    },
    [repo]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCommitsDebounced(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, searchCommitsDebounced]);

  // Filter tags and branches based on search
  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (ref: GitRef) => {
    onChange(ref.name);
    setOpen(false);
    setSearch("");
  };

  const displayValue = value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !repo}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {displayValue}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {initialLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {search.length > 0 && search.length < 4 ? (
                    <span className="text-muted-foreground">
                      Type at least 4 characters to search commits
                    </span>
                  ) : (
                    "No results found."
                  )}
                </CommandEmpty>

                {filteredTags.length > 0 && (
                  <CommandGroup heading="Tags">
                    {filteredTags.slice(0, 10).map((ref) => (
                      <CommandItem
                        key={`tag-${ref.name}`}
                        value={ref.name}
                        onSelect={() => handleSelect(ref)}
                      >
                        <RefIcon type={ref.type} />
                        <span className="truncate">{ref.displayName}</span>
                        {value === ref.name && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {filteredBranches.length > 0 && (
                  <CommandGroup heading="Branches">
                    {filteredBranches.slice(0, 10).map((ref) => (
                      <CommandItem
                        key={`branch-${ref.name}`}
                        value={ref.name}
                        onSelect={() => handleSelect(ref)}
                      >
                        <RefIcon type={ref.type} />
                        <span className="truncate">{ref.displayName}</span>
                        {value === ref.name && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {(commits.length > 0 || loading) && (
                  <CommandGroup heading="Commits">
                    {loading ? (
                      <div className="flex items-center px-2 py-1.5 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Searching commits...
                      </div>
                    ) : (
                      commits.map((ref) => (
                        <CommandItem
                          key={`commit-${ref.sha}`}
                          value={ref.sha}
                          onSelect={() => handleSelect(ref)}
                        >
                          <RefIcon type={ref.type} />
                          <span className="truncate font-mono text-xs">
                            {ref.displayName}
                          </span>
                          {value === ref.name && (
                            <Check className="ml-auto h-4 w-4" />
                          )}
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
