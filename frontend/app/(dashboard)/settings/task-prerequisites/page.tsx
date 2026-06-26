"use client";

import { useEffect, useState, useCallback } from "react";
import { useRequireRole, ROLES } from "@/lib/rbac";
import api from "@/lib/api";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import Link from "next/link";

interface TaskPrerequisite {
  id: string;
  stage: string;
  requiredStage: string;
  unlockThreshold: string;
  thresholdPercent: number | null;
}

const THRESHOLD_OPTIONS = [
  { value: "partial_any", label: "Any quantity produced" },
  { value: "full", label: "Fully complete" },
];

export default function TaskPrerequisitesPage() {
  useRequireRole([ROLES.ADMINISTRATOR]);

  const [prerequisites, setPrerequisites] = useState<TaskPrerequisite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPrerequisites = useCallback(async () => {
    try {
      const res = await api.get("/production-orders/task-prerequisites");
      setPrerequisites(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrerequisites();
  }, [fetchPrerequisites]);

  const handleSave = async (prereq: TaskPrerequisite) => {
    setSaving(prereq.stage);
    try {
      await api.post("/production-orders/task-prerequisites", {
        stage: prereq.stage,
        requiredStage: prereq.requiredStage,
        unlockThreshold: prereq.unlockThreshold,
      });
      await fetchPrerequisites();
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (stage: string) => {
    try {
      await api.delete(`/production-orders/task-prerequisites/${stage}`);
      setPrerequisites((prev) => prev.filter((p) => p.stage !== stage));
    } catch {
      // ignore
    }
  };

  const handleAdd = () => {
    const usedStages = new Set(prerequisites.map((p) => p.stage));
    const nextStage = STAGE_ORDER.find((s) => !usedStages.has(s));
    if (!nextStage) return;

    setPrerequisites((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        stage: nextStage,
        requiredStage: STAGE_ORDER[Math.max(0, STAGE_ORDER.indexOf(nextStage) - 1)],
        unlockThreshold: "partial_any",
        thresholdPercent: null,
      },
    ]);
  };

  const updatePrereq = (stage: string, field: string, value: string) => {
    setPrerequisites((prev) =>
      prev.map((p) => (p.stage === stage ? { ...p, [field]: value } : p))
    );
  };

  const usedStages = new Set(prerequisites.map((p) => p.stage));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Task Prerequisites</h1>
          <p className="text-sm text-zinc-500">
            Configure which stages must be at least partially complete before a downstream stage can start.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Stage Gating Rules</CardTitle>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={usedStages.size >= STAGE_ORDER.length}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : prerequisites.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              No prerequisite rules configured. All stages are open by default.
            </p>
          ) : (
            <div className="space-y-3">
              {prerequisites.map((prereq) => (
                <div
                  key={prereq.stage}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Stage</label>
                      <Select
                        value={prereq.stage}
                        onValueChange={(v) => v && updatePrereq(prereq.stage, "stage", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_ORDER.map((s) => (
                            <SelectItem key={s} value={s} disabled={usedStages.has(s) && s !== prereq.stage}>
                              {STAGE_LABELS[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Requires</label>
                      <Select
                        value={prereq.requiredStage}
                        onValueChange={(v) => v && updatePrereq(prereq.stage, "requiredStage", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_ORDER.filter((s) => s !== prereq.stage).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STAGE_LABELS[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Unlock when</label>
                      <Select
                        value={prereq.unlockThreshold}
                        onValueChange={(v) => v && updatePrereq(prereq.stage, "unlockThreshold", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THRESHOLD_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSave(prereq)}
                      disabled={saving === prereq.stage}
                    >
                      {saving === prereq.stage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(prereq.stage)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
