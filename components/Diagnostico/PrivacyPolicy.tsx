import Link from "next/link";
import { DELETION_PATH } from "@/lib/diagnostico/paths";
import {
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_UPDATED,
  privacyPolicySections,
} from "@/lib/diagnostico/privacy-policy-content";

// The privacy policy (RF-09): short titled sections in plain language, one column, no client code.
export default function PrivacyPolicy({ contactEmail }: { contactEmail: string }) {
  return (
    <article className="mx-auto max-w-[720px] py-4 xl:py-12">
      <h1 className="font-primary text-[40px] leading-none text-primary xl:text-[64px]">{PRIVACY_POLICY_TITLE}</h1>
      <p className="mt-3 text-sm text-secondary">Atualizada em {PRIVACY_POLICY_UPDATED}</p>
      {privacyPolicySections(contactEmail).map((section) => (
        <section key={section.id} id={section.id} className="mt-10">
          <h2 className="font-primary text-[28px] leading-tight text-primary">{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-base leading-relaxed text-secondary">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <div className="mt-12">
        <Link href={DELETION_PATH} className="btn btn-accent w-full text-sm font-semibold uppercase tracking-wider">
          Pedir exclusão dos meus dados
        </Link>
      </div>
    </article>
  );
}
