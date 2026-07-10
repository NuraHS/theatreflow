import { Palette, SlidersHorizontal, Timer, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DelayReason, WorkflowStage } from "@/lib/types/domain";

export function SettingsPanel({ stages, delayReasons }: { stages: WorkflowStage[]; delayReasons: DelayReason[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" aria-hidden="true" />
            Workflow stages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.map((stage) => (
            <div key={stage.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_120px_120px]">
              <div>
                <Label htmlFor={`${stage.id}-name`}>Name</Label>
                <Input id={`${stage.id}-name`} defaultValue={stage.name} />
              </div>
              <div>
                <Label htmlFor={`${stage.id}-threshold`}>Threshold</Label>
                <Input id={`${stage.id}-threshold`} type="number" defaultValue={stage.delay_threshold_minutes} />
              </div>
              <div>
                <Label htmlFor={`${stage.id}-colour`}>Colour</Label>
                <Input id={`${stage.id}-colour`} type="color" defaultValue={stage.colour} className="p-1" />
              </div>
            </div>
          ))}
          <Button type="button">Save stage settings</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
              Delay reasons
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {delayReasons.map((reason) => (
              <Badge key={reason.id} tone="blue">{reason.label}</Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              Lists and targets
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Input id="specialty" placeholder="Add specialty" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consultant">Consultant</Label>
              <Input id="consultant" placeholder="Add consultant" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority definition</Label>
              <Select id="priority">
                <option>Immediate</option>
                <option>Urgent</option>
                <option>Expedited</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Dashboard target minutes</Label>
              <Input id="target" type="number" placeholder="30" />
            </div>
            <Button type="button" className="sm:col-span-2">Save lists and targets</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
              Display
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Select aria-label="Board density">
              <option>Comfortable board density</option>
              <option>Compact board density</option>
            </Select>
            <Select aria-label="Notification threshold">
              <option>Notify after 30 minutes delayed</option>
              <option>Notify after 45 minutes delayed</option>
              <option>Notify after 60 minutes delayed</option>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
