import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigComponentProps } from '../types';
import DatasetCombobox from '@/components/replay/DatasetCombobox';
import { DatasetItem } from '@/lib/replayApi';
import WandbInstallDialog from '../WandbInstallDialog';
import { useApi } from '@/contexts/ApiContext';
import { checkPretrainedPath, PretrainedSourceCheck } from '@/lib/jobsApi';

interface EssentialsCardProps extends ConfigComponentProps {
  datasets: DatasetItem[];
  datasetsLoading: boolean;
}

const SMOLVLA_BASE_PATH = 'lerobot/smolvla_base';

const EssentialsCard: React.FC<EssentialsCardProps> = ({ config, updateConfig, datasets, datasetsLoading }) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const [wandbDialogOpen, setWandbDialogOpen] = useState(false);
  const [wandbInstallHint, setWandbInstallHint] = useState('pip install wandb');
  const [pretrainedCheck, setPretrainedCheck] = useState<PretrainedSourceCheck | null>(null);
  const [pretrainedChecking, setPretrainedChecking] = useState(false);

  // Debounced: verify the "fine-tune from" path/repo resolves to a real
  // pretrained model before the user commits to a training run on it.
  useEffect(() => {
    const source = config.pretrained_path?.trim();
    if (!source) {
      setPretrainedCheck(null);
      setPretrainedChecking(false);
      return;
    }
    setPretrainedChecking(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkPretrainedPath(baseUrl, fetchWithHeaders, source, controller.signal)
        .then(setPretrainedCheck)
        .catch(() => {
          // Aborted (superseded by a newer keystroke) or backend
          // unreachable — don't show a false negative for either.
        })
        .finally(() => setPretrainedChecking(false));
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config.pretrained_path, baseUrl, fetchWithHeaders]);

  // Only SmolVLA has a GUI-supported base checkpoint. If pretrained_path is
  // left over from switching away from SmolVLA (or from the initial
  // default), clear it so other policies don't silently send
  // --policy.pretrained_path lerobot/smolvla_base.
  useEffect(() => {
    if (config.policy_type !== 'smolvla' && config.pretrained_path) {
      updateConfig('pretrained_path', undefined);
    }
  }, [config.policy_type, config.pretrained_path, updateConfig]);

  const handleWandbToggle = async (checked: boolean) => {
    if (!checked) {
      updateConfig('wandb_enable', false);
      return;
    }
    // Check availability before flipping the switch on. If wandb isn't
    // importable in this lelab process, surface the same install flow used
    // for the training extra (accelerate) instead of letting the user start
    // a run that will fail.
    try {
      const r = await fetchWithHeaders(`${baseUrl}/system/wandb-extra`);
      const data: { available: boolean; install_hint: string } = await r.json();
      if (data.available) {
        updateConfig('wandb_enable', true);
      } else {
        setWandbInstallHint(data.install_hint);
        setWandbDialogOpen(true);
      }
    } catch {
      // Backend unreachable — let the user proceed; training start will
      // surface the real error if wandb is genuinely missing.
      updateConfig('wandb_enable', true);
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
      <CardHeader>
        <CardTitle className="text-white">Run Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-slate-300">Dataset Repository ID *</Label>
          <div className="mt-1">
            <DatasetCombobox
              datasets={datasets}
              loading={datasetsLoading}
              value={config.dataset_repo_id || null}
              onChange={(repoId) => {
                if (repoId) updateConfig('dataset_repo_id', repoId);
              }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            HuggingFace Hub dataset repository ID
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="policy_type" className="text-slate-300">
              Policy
            </Label>
            <Select
              value={config.policy_type}
              onValueChange={(value) => updateConfig('policy_type', value)}
            >
              <SelectTrigger id="policy_type" className="bg-slate-900 border-slate-600 text-white rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 text-white">
                <SelectItem value="act">ACT (Action Chunking Transformer)</SelectItem>
                <SelectItem value="diffusion">Diffusion Policy</SelectItem>
                <SelectItem value="pi0">PI0</SelectItem>
                <SelectItem value="smolvla">SmolVLA</SelectItem>
                <SelectItem value="groot">GR00T N1.7</SelectItem>
                <SelectItem value="tdmpc">TD-MPC</SelectItem>
                <SelectItem value="vqbet">VQ-BeT</SelectItem>
                <SelectItem value="pi0_fast">PI0 Fast</SelectItem>
                <SelectItem value="sac">SAC</SelectItem>
                <SelectItem value="reward_classifier">Reward Classifier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.policy_type === 'smolvla' && (
            <div>
              <Label htmlFor="pretrained_path" className="text-slate-300">
                Pretrained policy path (fine-tune from)
              </Label>

              <div className="flex items-center space-x-2 mt-1 mb-2">
                <Checkbox
                  id="fine_tune_smolvla_base"
                  checked={config.pretrained_path === SMOLVLA_BASE_PATH}
                  onCheckedChange={(checked) =>
                    updateConfig(
                      'pretrained_path',
                      checked ? SMOLVLA_BASE_PATH : undefined,
                    )
                  }
                />
                <Label
                  htmlFor="fine_tune_smolvla_base"
                  className="text-slate-300 font-normal cursor-pointer"
                >
                  Fine-tune from pretrained SmolVLA base
                </Label>
              </div>

              {config.pretrained_path !== SMOLVLA_BASE_PATH && (
                <>
                  <Input
                    id="pretrained_path"
                    value={config.pretrained_path ?? ''}
                    onChange={(e) =>
                      updateConfig('pretrained_path', e.target.value || undefined)
                    }
                    placeholder="lerobot/smolvla_base"
                    className="bg-slate-900 border-slate-600 text-white rounded-lg"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Leave empty to train from scratch. Almost always you want to fine-tune.
                  </p>
                </>
              )}

              {config.pretrained_path?.trim() && (
                <p className="text-xs mt-1 flex items-center gap-1.5">
                  {pretrainedChecking ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                      <span className="text-slate-500">Checking…</span>
                    </>
                  ) : pretrainedCheck?.valid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-green-500">
                        Found{pretrainedCheck.policy_type ? ` (${pretrainedCheck.policy_type})` : ''}
                      </span>
                    </>
                  ) : pretrainedCheck && !pretrainedCheck.valid ? (
                    <>
                      <XCircle className="w-3 h-3 text-red-500" />
                      <span className="text-red-500">{pretrainedCheck.message}</span>
                    </>
                  ) : null}
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="steps" className="text-slate-300">
              Training Steps
            </Label>
            <NumberInput
              id="steps"
              value={config.steps}
              onChange={(v) => {
                if (v !== undefined) updateConfig('steps', v);
              }}
              className="bg-slate-900 border-slate-600 text-white rounded-lg"
            />
          </div>

          <div>
            <Label htmlFor="batch_size" className="text-slate-300">
              Batch Size
            </Label>
            <NumberInput
              id="batch_size"
              value={config.batch_size}
              onChange={(v) => {
                if (v !== undefined) updateConfig('batch_size', v);
              }}
              className="bg-slate-900 border-slate-600 text-white rounded-lg"
            />
          </div>

          <div className="flex items-center space-x-3 pt-6">
            <Switch
              id="wandb_enable"
              checked={config.wandb_enable}
              onCheckedChange={handleWandbToggle}
              className="data-[state=checked]:bg-green-500"
            />
            <Label htmlFor="wandb_enable" className="text-slate-300">
              Enable Weights & Biases
            </Label>
          </div>
        </div>

        <WandbInstallDialog
          open={wandbDialogOpen}
          onOpenChange={setWandbDialogOpen}
          installHint={wandbInstallHint}
        />

        {config.wandb_enable && (
          <div>
            <Label htmlFor="wandb_project" className="text-slate-300">
              W&B Project Name
            </Label>
            <Input
              id="wandb_project"
              value={config.wandb_project || ''}
              onChange={(e) =>
                updateConfig('wandb_project', e.target.value || undefined)
              }
              placeholder="my-robotics-project"
              className="bg-slate-900 border-slate-600 text-white rounded-lg"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EssentialsCard;
