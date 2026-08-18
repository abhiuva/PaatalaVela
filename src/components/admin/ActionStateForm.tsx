"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Children, cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

type Result = {
  ok: boolean;
  message: string;
  code?: string;
  field?: string;
  results?: Array<{ youtubeVideoId: string; status: string; message: string }>;
  values?: Record<string, string>;
};

type ActionStateFormProps = {
  action: (previousState: Result | null, formData: FormData) => Promise<Result>;
  children: ReactNode;
  submitLabel: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-white px-3 py-2 text-sm font-bold text-black transition hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60"
    >
      {pending ? "Saving" : label}
    </button>
  );
}

function preserveValues(children: ReactNode, values: Record<string, string> | undefined): ReactNode {
  if (!values) return children;

  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;

    const element = child as ReactElement<Record<string, unknown>>;
    const name = typeof element.props.name === "string" ? element.props.name : null;
    const type = typeof element.props.type === "string" ? element.props.type : "";
    const nextChildren = element.props.children ? preserveValues(element.props.children as ReactNode, values) : element.props.children;
    const nextProps: Record<string, unknown> = {};

    if (nextChildren !== element.props.children) {
      nextProps.children = nextChildren;
    }

    if (name && Object.prototype.hasOwnProperty.call(values, name) && type !== "checkbox" && type !== "radio" && element.props.defaultValue === undefined && element.props.value === undefined) {
      nextProps.defaultValue = values[name];
    }

    return Object.keys(nextProps).length > 0 ? cloneElement(element, nextProps) : child;
  });
}

export function ActionStateForm({ action, children, submitLabel }: ActionStateFormProps) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3">
      {preserveValues(children, state?.values)}
      {state ? (
        <div className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-400/15 text-emerald-50" : "bg-red-400/15 text-red-50"}`}>
          {state.message}
          {state.field ? <p className="mt-1 text-xs opacity-80">Field: {state.field}</p> : null}
          {state.code ? <p className="mt-1 text-xs opacity-80">Code: {state.code}</p> : null}
          {state.results && state.results.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {state.results.map((result) => (
                <li key={`${result.youtubeVideoId}-${result.status}`}>
                  {result.youtubeVideoId}: {result.status} - {result.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <SubmitButton label={submitLabel} />
    </form>
  );
}
