import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Combine, Loader2 } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";
import { useToast } from "@/hooks/use-toast";
import { DatasetItem } from "@/lib/replayApi";

interface MergeDatasetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasets: DatasetItem[];
  onMerged: () => void;
}

const MergeDatasetsModal: React.FC<MergeDatasetsModalProps> = ({
  open,
  onOpenChange,
  datasets,
  onMerged,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outputName, setOutputName] = useState("");
  const [pushToHub, setPushToHub] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleSelected = (repoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const canMerge = selected.size >= 2 && outputName.trim().length > 0 && !submitting;

  const reset = () => {
    setSelected(new Set());
    setOutputName("");
    setPushToHub(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) reset();
    onOpenChange(nextOpen);
  };

  const handleMerge = async () => {
    if (!canMerge) return;
    setSubmitting(true);
    try {
      const response = await fetchWithHeaders(`${baseUrl}/merge-datasets`, {
        method: "POST",
        body: JSON.stringify({
          repo_ids: Array.from(selected),
          output_repo_id: outputName.trim(),
          push_to_hub: pushToHub,
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Datasets merged",
          description: data.message ?? `Merged into ${outputName.trim()}.`,
        });
        reset();
        onOpenChange(false);
        onMerged();
      } else {
        toast({
          title: "Couldn't merge datasets",
          description: data.message ?? "Failed to merge datasets.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Couldn't merge datasets",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[600px] p-8 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-center items-center mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Combine className="w-4 h-4 text-white" />
            </div>
          </div>
          <DialogTitle className="text-white text-center text-2xl font-bold">
            Combine Datasets
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <DialogDescription className="text-gray-400 text-base leading-relaxed text-center">
            Pick two or more datasets to merge into a new one. The originals
            are kept as-is — nothing is deleted.
          </DialogDescription>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
              Datasets to combine
            </h3>
            {datasets.length === 0 ? (
              <Alert className="bg-amber-900/40 border-amber-700 text-amber-100">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>No datasets available yet.</AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1 rounded-md border border-gray-700 p-2">
                {datasets.map((d) => (
                  <label
                    key={d.repo_id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-800 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(d.repo_id)}
                      onCheckedChange={() => toggleSelected(d.repo_id)}
                      className="border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <span className="text-sm text-gray-200 truncate">
                      {d.repo_id}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              {selected.size} selected
              {selected.size > 0 && selected.size < 2
                ? " — pick at least one more"
                : ""}
              . All selected datasets must share the same robot type, FPS,
              and cameras (same names and resolution).
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="mergeOutputName"
              className="text-sm font-medium text-gray-300"
            >
              Output dataset name
            </Label>
            <Input
              id="mergeOutputName"
              value={outputName}
              onChange={(e) =>
                setOutputName(e.target.value.replace(/[^A-Za-z0-9._-]/g, "_"))
              }
              placeholder="my_merged_dataset"
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-xs text-gray-500">
              Letters, numbers, <code>.</code> <code>_</code> <code>-</code>{" "}
              only — other characters become <code>_</code>.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="mergePushToHub"
              checked={pushToHub}
              onCheckedChange={(value) => setPushToHub(value === true)}
              className="mt-0.5 border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
            />
            <Label
              htmlFor="mergePushToHub"
              className="text-sm font-medium text-gray-200 cursor-pointer"
            >
              Push merged dataset to Hugging Face Hub
            </Label>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              onClick={handleMerge}
              disabled={!canMerge}
              className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white px-10 py-6 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Merging…
                </>
              ) : (
                <>
                  <Combine className="w-5 h-5 mr-2" />
                  Merge
                </>
              )}
            </Button>
            <Button
              onClick={() => handleClose(false)}
              disabled={submitting}
              variant="outline"
              className="w-full sm:w-auto border-gray-500 hover:border-gray-200 px-10 py-6 text-lg text-zinc-500 bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MergeDatasetsModal;
