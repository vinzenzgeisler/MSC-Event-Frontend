import { useId, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

const commonMarshalShirtSizes = [
  "H-XS", "H-S", "H-M", "H-L", "H-XL", "H-2XL", "H-3XL", "H-4XL", "H-5XL", "H-6XL",
  "D-XS", "D-S", "D-M", "D-L", "D-XL", "D-2XL", "D-3XL", "D-4XL",
  "K-98", "K-104", "K-110", "K-116", "K-122", "K-128", "K-134", "K-140", "K-146", "K-152", "K-158", "K-164",
];

export function MarshalShirtSizeInput(props: ComponentProps<typeof Input>) {
  const optionsId = useId();
  return <>
    <Input {...props} list={optionsId} placeholder="z. B. H-L oder D-M" />
    <datalist id={optionsId}>
      {commonMarshalShirtSizes.map((size) => <option key={size} value={size} />)}
    </datalist>
  </>;
}
