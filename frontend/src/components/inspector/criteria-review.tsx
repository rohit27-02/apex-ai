'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, X, Pencil } from 'lucide-react';
import type { CriteriaItem } from '@/types/run';

interface CriteriaReviewProps {
  criteria: CriteriaItem[];
  onConfirm: (criteria: CriteriaItem[]) => void;
  onReject: () => void;
}

export function CriteriaReview({ criteria: initial, onConfirm, onReject }: CriteriaReviewProps) {
  const [criteria, setCriteria] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateLabel = (id: string, label: string) => {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        Success Criteria
      </h3>
      <ul className="space-y-1" role="list" aria-label="Success criteria list">
        {criteria.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-card border border-border hover:border-muted-foreground/30 transition-colors"
          >
            <Badge variant={c.status === 'passed' ? 'secondary' : c.status === 'failed' ? 'destructive' : 'outline'}>
              {c.status}
            </Badge>
            {editingId === c.id ? (
              <Input
                autoFocus
                value={c.label}
                onChange={(e) => updateLabel(c.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                className="h-6 text-xs border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label={`Edit criterion: ${c.label}`}
              />
            ) : (
              <span className="flex-1 text-xs text-muted-foreground font-medium">{c.label}</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setEditingId(editingId === c.id ? null : c.id)}
              aria-label={`Edit criterion: ${c.label}`}
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="default" onClick={() => onConfirm(criteria)}>
          <Check className="h-3 w-3" aria-hidden="true" />
          Confirm
        </Button>
        <Button size="sm" variant="destructive" onClick={onReject}>
          <X className="h-3 w-3" aria-hidden="true" />
          Reject
        </Button>
      </div>
    </div>
  );
}
