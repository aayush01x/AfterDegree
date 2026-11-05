import type { ToolField } from "@/lib/tools";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import styles from "./ToolFields.module.css";

/** Generic parameter fields; values are uncontrolled and read from FormData by ToolLayout. */
export function ToolFields({ fields, values, errors = {} }: { fields: ToolField[]; values: Record<string, string>; errors?: Record<string, string> }) {
  return (
    <div className={styles.fields}>
      {fields.map((f) =>
        f.kind === "select" ? (
          <Select key={f.name} name={f.name} label={f.label} hint={f.help} error={errors[f.name]} options={f.options ?? []} defaultValue={values[f.name] || f.options?.[0]?.value} />
        ) : (
          <Input
            key={f.name}
            name={f.name}
            label={f.label}
            optional={!f.required}
            required={f.required}
            placeholder={f.placeholder}
            hint={f.help}
            error={errors[f.name]}
            defaultValue={values[f.name] ?? ""}
            autoComplete="off"
          />
        ),
      )}
    </div>
  );
}
