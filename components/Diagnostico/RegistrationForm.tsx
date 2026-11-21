"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_TEXT, PRIVACY_PATH } from "@/lib/diagnostico/consent";
import { maskWhatsapp } from "@/lib/diagnostico/phone";
import { customerFormSchema } from "@/lib/diagnostico/schemas/customer";

type FieldName = "fullName" | "email" | "whatsapp" | "deliveryPreference" | "consent";
type Errors = Partial<Record<FieldName, string>>;

type Values = {
  fullName: string;
  email: string;
  whatsapp: string;
  deliveryPreference: string;
  consent: boolean;
};

const FIELD_ORDER: FieldName[] = ["fullName", "email", "whatsapp", "deliveryPreference", "consent"];
const NEXT_PATH = "/diagnostico-estilo/perguntas";
const VALIDATION_KEY = "00000000-0000-4000-8000-000000000000";

const MESSAGE_NETWORK = "Não conseguimos enviar seus dados. Tente novamente.";
const MESSAGE_RATE_LIMIT = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
const MESSAGE_SERVER = "Não foi possível concluir agora. Tente novamente.";

// The diagnosis is always delivered by e-mail, so the customer is not asked to choose.
const DELIVERY_PREFERENCE = "email";

function validate(values: Values): Errors {
  const result = customerFormSchema.safeParse({ ...values, idempotencyKey: VALIDATION_KEY });
  if (result.success) return {};
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as FieldName;
    if (FIELD_ORDER.includes(field) && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function ConsentLabel() {
  const [before, after] = CONSENT_TEXT.split("Política de Privacidade");
  return (
    <span>
      {before}
      <Link href={PRIVACY_PATH} className="text-accent underline underline-offset-4" target="_blank">
        Política de Privacidade
      </Link>
      {after}
    </span>
  );
}

export default function RegistrationForm() {
  const router = useRouter();
  const idempotencyKey = useRef<string>();
  const [values, setValues] = useState<Values>({
    fullName: "",
    email: "",
    whatsapp: "",
    deliveryPreference: DELIVERY_PREFERENCE,
    consent: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  function update(field: FieldName, value: string | boolean) {
    const next = { ...values, [field]: value } as Values;
    setValues(next);
    // Once a field has been touched, keep its message in sync while the customer fixes it.
    if (touched[field]) setErrors((current) => ({ ...current, [field]: validate(next)[field] }));
  }

  function touch(field: FieldName, nextValues: Values = values) {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validate(nextValues)[field] }));
  }

  function focusField(field: FieldName) {
    document.getElementById(`field-${field}`)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");

    const found = validate(values);
    setTouched({ fullName: true, email: true, whatsapp: true, deliveryPreference: true, consent: true });
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    // The same key is reused on every retry, so a double click or a retry never creates two attempts.
    idempotencyKey.current ??= crypto.randomUUID();
    setSubmitting(true);
    try {
      const response = await fetch("/api/diagnostico/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, idempotencyKey: idempotencyKey.current }),
      });
      if (response.ok) {
        router.push(NEXT_PATH);
        return;
      }
      if (response.status === 429) {
        setFormError(MESSAGE_RATE_LIMIT);
      } else if (response.status === 400) {
        const body = await response.json().catch(() => null);
        const fields = (body?.error?.fields ?? {}) as Record<string, string[]>;
        const serverErrors: Errors = {};
        for (const field of FIELD_ORDER) if (fields[field]?.[0]) serverErrors[field] = fields[field][0];
        setErrors(serverErrors);
        setFormError(Object.keys(serverErrors).length ? "" : MESSAGE_SERVER);
      } else {
        setFormError(MESSAGE_SERVER);
      }
    } catch {
      setFormError(MESSAGE_NETWORK);
    }
    setSubmitting(false);
  }

  function describe(field: FieldName) {
    return errors[field] ? `error-${field}` : undefined;
  }

  const errorText = (field: FieldName) =>
    errors[field] ? (
      <p id={`error-${field}`} className="mt-1 text-sm text-red-600" aria-live="polite">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div>
        <label htmlFor="field-fullName" className="mb-2 block text-sm font-medium text-primary">
          Nome completo
        </label>
        <input
          id="field-fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          className="input"
          value={values.fullName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update("fullName", e.target.value)}
          onBlur={() => touch("fullName")}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={describe("fullName")}
        />
        {errorText("fullName")}
      </div>

      <div>
        <label htmlFor="field-email" className="mb-2 block text-sm font-medium text-primary">
          E-mail
        </label>
        <input
          id="field-email"
          name="email"
          type="email"
          autoComplete="email"
          className="input"
          value={values.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update("email", e.target.value)}
          onBlur={() => touch("email")}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describe("email")}
        />
        {errorText("email")}
      </div>

      <div>
        <label htmlFor="field-whatsapp" className="mb-2 block text-sm font-medium text-primary">
          WhatsApp com DDD
        </label>
        <input
          id="field-whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          className="input"
          value={values.whatsapp}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update("whatsapp", maskWhatsapp(e.target.value))}
          onBlur={() => touch("whatsapp")}
          aria-invalid={Boolean(errors.whatsapp)}
          aria-describedby={describe("whatsapp")}
        />
        {errorText("whatsapp")}
      </div>

      <div>
        <label htmlFor="field-consent" className="flex cursor-pointer items-start gap-3 text-sm text-secondary">
          <input
            id="field-consent"
            name="consent"
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-accent"
            checked={values.consent}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              update("consent", e.target.checked);
              touch("consent", { ...values, consent: e.target.checked });
            }}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={describe("consent")}
          />
          <ConsentLabel />
        </label>
        {errorText("consent")}
      </div>

      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-accent w-full text-sm font-semibold uppercase tracking-wider disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "COMEÇAR O QUESTIONÁRIO"}
      </button>
    </form>
  );
}

