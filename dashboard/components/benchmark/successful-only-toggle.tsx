import { useAtom } from "jotai";
import { successfulOnlyAtom } from "@/store/filters";
import { Switch } from "../ui/switch";

export function SuccessfulOnlyToggle() {
  const [successfulOnly, setSuccessfulOnly] = useAtom(successfulOnlyAtom);

  return (
    <div className="flex gap-1.5">
      <span className="text-muted-foreground text-xs">Successful Only</span>
      <Switch
        checked={successfulOnly}
        className="w-fit"
        onCheckedChange={setSuccessfulOnly}
      />
    </div>
  );
}
